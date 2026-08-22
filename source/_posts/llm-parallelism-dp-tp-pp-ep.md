---
title: 大模型推理中常见的并行策略
date: 2026-08-18 22:44:00
updated: 2026-08-18 22:44:00
tags:
  - 分布式推理
  - 并行策略
categories:
  - LLM
---

主流大模型的参数基本上都几百B，甚至Kimi K3达到了2.8T，单张 GPU 既放不下参数，也算不动。于是需要把「模型」和「数据」拆开，分到成百上千张 GPU 上协同计算 —— 这就是**分布式并行**。围绕「切什么、怎么通信」，大致上有四种基本并行策略，常见的推理框架还会有CP(context parallel)等切分方式。

| 缩写 | 全称 | 如何切分 |
| --- | --- | --- |
| **DP** | Data Parallelism，数据并行 | 按照BATCH切分给多个副本 |
| **TP** | Tensor Parallelism，张量并行 | 权重切分给TP组内的多个GPU |
| **PP** | Pipeline Parallelism，流水线并行 | 多个layer按层切分给不同GPU |
| **EP** | Expert Parallelism，专家并行 | MoE 中按照专家维度切分到多个GPU |

下面逐个介绍，最后给出它们的组合方式与示意图。


## 预备：常见通信原语

分布式训练 / 推理中，数据需要在多个 GPU 之间按固定的**集合通信（Collective Communication）**模式交换。下面四个是基础原语，后续各并行策略都会用到（P 为参与通信的 GPU 数，V 为每张卡的数据量）。

**1. Reduce-Scatter（归约-分散）**

- 每张卡把自己的数据分成 P 份，把第 i 份发送给第 i 张卡；同时接收其他卡发来的对应份，做**逐元素归约**（通常为求和，也可为求最大 / 最小）。
- 结束时：每张卡持有**其中一份数据的全局归约结果**（含本地份额）。
- 通信量约 (P−1)/P × 全体数据量，环形（Ring）实现下与 GPU 数弱相关。
- 典型用途：Ring AllReduce 的前半段、ZeRO 的梯度分片。

**2. All-Gather（全收集）**

- Reduce-Scatter 的**逆操作**：每张卡把自己持有的数据分片发给所有卡，最终**每张卡都拥有完整数据**（全体分片拼接，共 P·V）。
- 典型用途：TP 行并行 / 列并行的结果拼接、ZeRO 的权重恢复。

**3. All-Reduce（全归约）**

- 每张卡都得到**全体数据的归约结果**（如所有卡对应元素求和）。
- 标准实现 = Reduce-Scatter + All-Gather 两步（Ring AllReduce 正是这个结构），通信量约为 Reduce-Scatter 的两倍。
- 典型用途：DP 的梯度同步、TP 计算结果的合并。

**4. All-to-All（全交换）**

- 比前三个更通用：每张卡向**其他每一张卡**发送互不相同的数据，同时接收来自各卡的数据。
- 典型用途：MoE 的 token 路由（EP 通信）、序列并行、部分 Attention 实现。

四个原语的对比小结：

| 原语 | 输入（每卡） | 输出（每卡） | 典型用途 |
| --- | --- | --- | --- |
| reduce-scatter | 数据 V | 其中 1 份的全局归约结果 | Ring AllReduce 前半段、ZeRO 分片 |
| all-gather | 数据分片 V/P | 完整数据 P·V | TP 结果拼接、ZeRO 恢复 |
| all-reduce | 数据 V | 全体数据的归约结果 | DP 梯度同步、TP 合并 |
| all-to-all | 发给各卡的不同数据 | 各卡发来的数据 | MoE token 路由、序列并行 |

## 一、DP：数据并行

**思路**：每张卡（或每个DP组）持有一份**完整的模型副本**，把输入数据按 batch 维度切成 N 份分给 N 个副本，各副本独立完成前向计算。

**特点**：

- 实现最简单，扩展性最好，可以横向扩展吞吐量。
- **不降低单卡显存**：每张卡仍要放下完整模型，所以显存不够时不能只靠 DP。

## 二、TP：张量并行

**思路**：把权重切分到多个 GPU 上，每个 GPU 只跑该算子的**部分计算**，计算完成后通过通信合并多个 GPU 的结果。张量并行分为两种：**行并行**与**列并行**。

| | 行并行 | 列并行 |
| --- | --- | --- |
| 切分方式 | 权重 Y **按列**拆分为 [Y1, Y2] | 权重 Y **按行**拆分为 [Y1; Y2] |
| 计算 | 两个设备分别计算 X@Y1、X@Y2 | 两个设备分别进行计算 |
| 通信合并 | **all-gather 拼接**两个结果矩阵 | **all-reduce 求和** |
| 最终结果 | 按列拼接成完整结果 | 对应元素相加得到完整结果 |

大模型中有三类核心模块 Attention、FFN 和 embedding / lm-head，下面以 VLLM 中的实现简单介绍这两个模块如何进行切分与计算。

### 1. FFN 的 TP 切分

FFN 的基本结构如下图，其基本计算为 down_proj(SwiGlu(gate(X)) · up_proj(X))，各组成部分含义如下：

| 名称 | 含义 | 维度 |
| --- | --- | --- |
| X | Attention 的输出 | [bs, seq_len, dim] |
| gate | 门控的 dense 权重 | [dim, intermediate] |
| SwiGlu | 激活函数，缩放 up_proj 提取的特征 | 函数，对输入矩阵逐一运算 |
| up_proj | 提取输入特征 | [dim, intermediate] |
| down_proj | 保持 FFN 输出维度与输入一致 | [intermediate, dim] |

在工程实现中，SwiGlu(gate(X)) · up_proj(X) 可以合并为 **SiluAndMul 算子**：

1. 把 gate 与 up_proj 两个权重矩阵合并为一个矩阵 W [dim, 2×intermediate]；
2. 一次矩阵乘 X @ W 即可同时算出两个部分的结果；
3. 对前一半列应用激活函数，再与后一半列**按位乘**。

最终流程简化为 down_proj(SiluAndMul(W, X))。

假设有两块 GPU，下面分别看**行并行切分**与**列切分**两种方式。

**方式一：行并行切分 gate / up_proj**

- **GPU0**：拿 gate、up_proj 的**前一半行**权重，拼接为 W1 [dim/2, 2×intermediate]；输入为匹配做**列切分**，取前一半列 X1 [bs, seq_len, dim/2]，计算 X1 @ W1 → [bs, seq_len, 2×intermediate]。
- **GPU1**：拿**后一半行**权重，拼接为 W2 [dim/2, 2×intermediate]；取输入后一半列 X2 [bs, seq_len, dim/2]，计算 X2 @ W2 → [bs, seq_len, 2×intermediate]。
- 两部分 **all-reduce 相加**后才是最终结果。⚠️ 不能直接使用 SiluAndMul(W1, X1)：SwiGlu 不是线性函数，SwiGlu(X1@gate1 + X2@gate2) ≠ SwiGlu(X1@gate1) + SwiGlu(X2@gate2)，因此**行并行切分会额外引入一次通信**，最终结果再送入 down_proj。

**方式二：列切分 gate / up_proj**

- **GPU0**：拿 gate、up_proj 的**前一半列** [dim, intermediate/2]，拼接出 W1 [dim, intermediate]，X 直接复制到该 GPU 上。因为列切分的结果无需相加、只需在对应维度拼接，可以直接使用 SiluAndMul(W1, X)。
- **GPU1**：同理。
- 得到两部分结果 A1、A2 后，对 down_proj 做**行切分**，两个 GPU 内分别对 A1、A2 做矩阵乘，最后结果再引入一次 **all-reduce 相加**。
- 结论：列切分在送入 down_proj 前**无需额外引入通信**，效率更高。

### 2. MHA 的 TP 切分

MHA 的输入维度是 [bs, seq_len, #head, head_dim]，每个 head 独立计算 qkv，因此天然可以在 **head 维度**拆分：不同设备计算不同的 head。计算完每个 head 的 attention score 后需要经过 **out_proj** 线性层（与 dense 类似，可按行切分），最后再 **all-reduce 相加**汇总。计算示例如下：

```python
# tp_size为2的场景，GPU0上，其中hidden_dim = #head * head_dim
# GPU0上：
wq_sub1 = wq_weight[:, :hidden_dim // 2]
wk_sub1 = wk_weight[:, :hidden_dim // 2]
wv_sub1 = wv_weight[:, :hidden_dim // 2]
wo_sub1 = wo_weight[:hidden_dim // 2, :]
# [bs, seq_len, hidden_dim//2] -> [bs, seq_len, #head/2, head_dim]，获取前一半head
q1 = (inputs @ wq_sub1).view(bs, seq_len, num_head/2, head_dim).transpose(1, 2)
k1 = (inputs @ wk_sub1).view(bs, seq_len, num_head/2, head_dim).transpose(1, 2)
v1 = (inputs @ wv_sub1).view(bs, seq_len, num_head/2, head_dim).transpose(1, 2)
# 省略mask [bs, seq_len, #head/2, #head/2]
attention_weight = softmax(q1 @ k1.transpose(2, 3) / head_dim**0.5, dim=-1)
# [bs, seq_len, #head/2, #head/2] -> [bs, seq_len, hidden_dim//2]
context = (attention_weight @ v1).view(bs, seq_len, hidden_dim//2)
# out_proj行切分后维度是[hidden_dim//2, hidden_dim]
res = out_proj1(context)
# GPU0上最终得到的结果[bs, seq_len, hidden_dim]，GPU1也是一样的，最后这两个GPU进行all-reduce得到最终attention结果

```

## 三、PP：流水线并行

**思路**：按**层**把网络切成连续的若干段（stage），每段放在不同的 GPU 上，第 1 段算完一小批就传给第 2 段，各段同时开工，形成流水线。

**特点**：

- 通信只发生在**相邻stage之间**（传递激活），数据量小，对带宽要求低，**非常适合跨节点**（以太网 / IB 也可以）。
- 能降低每卡显存（每卡只放自己那几层）。

## 四、EP：专家并行

**思路**：专门针对 **MoE（Mixture-of-Experts）** 模型。MoE 把 FFN 层替换成多个「专家」（expert），每个 token 由**门控网络（Router）**挑选 top-k 个专家来计算，每一个专家就是之前的 FFN。EP 就是把众多专家**分布到不同的 GPU** 上，每个专家只处理被路由给它的 token。大模型中的大部分参数来自于moe结构，通过这个结构既保留了训练时模型的探索能力，又在推理时只选择topk个专家从而节省了算力。pytorch中moe forward部分代码如下：
```python
# x: (batch, seq_len, emb_dim)
scores = self.gate(x)  # (b, seq_len, num_experts)
topk_scores, topk_indices = torch.topk(scores, self.num_experts_per_tok, dim=-1)
topk_probs = torch.softmax(topk_scores, dim=-1)

batch, seq_len, _ = x.shape
x_flat = x.reshape(batch * seq_len, -1)
out_flat = torch.zeros(batch * seq_len, self.emb_dim, device=x.device, dtype=x.dtype)

topk_indices_flat = topk_indices.reshape(-1, self.num_experts_per_tok)
topk_probs_flat = topk_probs.reshape(-1, self.num_experts_per_tok)

unique_experts = torch.unique(topk_indices_flat)

# 整体思路是一次性处理整个batch关于这个expert的输入
for expert_id_tensor in unique_experts:
    expert_id = int(expert_id_tensor.item())

    mask = topk_indices_flat == expert_id
    if not mask.any():
        continue

    token_mask = mask.any(dim=-1)
    selected_idx = token_mask.nonzero(as_tuple=False).squeeze(-1)
    if selected_idx.numel() == 0:
        continue

    # extract the token row, if this row use expert with expert_id
    expert_input = x_flat.index_select(0, selected_idx)
    # self.fc1 worked as gate
    hidden = torch.nn.functional.silu(self.fc1[expert_id](expert_input)) * self.fc2[
        expert_id
    ](expert_input)
    expert_out = self.fc3[expert_id](hidden)

    mask_selected = mask[selected_idx]
    slot_indices = mask_selected.int().argmax(dim=-1, keepdim=True)
    # choose the weight of this expert for each selected token
    selected_probs = torch.gather(
        topk_probs_flat.index_select(0, selected_idx), dim=-1, index=slot_indices
    ).squeeze(-1)

    # weighted sum
    out_flat.index_add_(0, selected_idx, expert_out * selected_probs.unsqueeze(-1))
```
<figure style="text-align:center;margin:1.5em auto;">
  <img src="/img/moe.png" alt="MoE 结构示意" style="display:block;margin:0 auto;max-width:100%;height:auto;">
  <figcaption style="text-align:center;color:#666;font-size:0.9em;margin-top:0.5em;">图：MoE 结构示意</figcaption>
</figure>

**特点**：

- 把**远超单卡容量**的专家参数量摊到更多卡上，专家总数可以远大于 GPU 数（一张卡可承载多个专家分片）。
- 通信发生在 **token 的路由交换（All-to-All）**：Router 决定后，token 需要送到专家所在的卡。
- 核心难点是**负载均衡**：若大量 token 涌向少数热门专家，会拖慢整体。常用 top-k 路由 + 辅助损失（aux loss，如 Switch / GShard），或 DeepSeek 的无辅助损失路由。
- 代表模型：Mixtral、DeepSeek-MoE / V3、Qwen-MoE、Grok 等。

## 五、组合方式

四种并行切的是**不同的维度**（数据、权重、层、专家），因此可以**叠加**使用。业界标准做法是「三维并行」**DP × PP × TP**（Megatron + DeepSpeed 的默认组合），MoE 模型再叠加 EP。

### 组合原则：通信成本匹配硬件拓扑

并行度划分要遵循「**通信密集的维度放带宽高的地方**」：

1. **TP** 通信最密（每层两次 AllReduce）→ 放在**单机内**（NVLink），TP 维度 ≤ 单机卡数；
2. **EP** 次之（All-to-All）→ 尽量放在**节点内**或相邻节点；
3. **PP** 通信量小 → 可以**跨节点**串联；
4. **DP** 只做梯度同步 → 可以**全局**扩展（甚至跨机房）。

## 六、vllm与Sglang启动配置
