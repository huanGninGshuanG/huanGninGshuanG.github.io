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


## 一、常见通信原语
1. reduce-scatter: 
2. all-gather:
3. all-reduce:
4. all-to-all

## 一、DP：数据并行

**思路**：每张卡（或每个DP组）持有一份**完整的模型副本**，把输入数据按 batch 维度切成 N 份分给 N 个副本，各副本独立完成前向计算。

**特点**：

- 实现最简单，扩展性最好，可以横向扩展吞吐量。
- **不降低单卡显存**：每张卡仍要放下完整模型，所以显存不够时不能只靠 DP。

## 二、TP：张量并行

**思路**：把权重切分到多个GPU上，因此每个GPU只跑该算子的部分计算，计算完成后需要通过**all-reduce**进行合并多个gpu的计算结果。大模型中有两类核心的模块`Attention`和`FFN`，下面以VLLM中的实现简单介绍一下这两个模块如何进行切分与计算。

### 1. FFN的TP切分

FFN中的基本结构如下图，其基本计算为`down_proj(SwiGlu(gate(X))*up_proj(X))`，其中各个部分含义如下：

| 名称 | 含义 | 维度 |
| --- | --- | --- |
| X | Attention的输出 | [bs, seq_len, dim] |
| gate | 门控的dense权重 | [intermediate, dim] |
| SwiGlu | 激活函数，缩放up_proj中提取的特征 | 函数，对输入矩阵逐一运算 |
| up_proj | 提取输入特征 | [intermediate, dim] |
| down_proj | 保持FFN输出维度与输入维度一致 | [dim, intermediate] |


{% cudadiagram ffn %}

### 2. MHA的TP切分

## 三、PP：流水线并行

**思路**：按**层**把网络切成连续的若干段（stage），每段放在不同的 GPU / GPU 组上。输入先以**微批次（micro-batch）**切碎，第 1 段算完一小批就传给第 2 段，各段同时开工，形成流水线。

两种经典调度：

- **GPipe**：先整批前向、再整批反向，实现简单但空转（bubble）多；
- **1F1B**（one-forward-one-backward）：前向与反向交错执行，bubble 更小、显存更省，是 Megatron / DeepSpeed 的主流选择。

**特点**：

- 通信只发生在**相邻段之间**（传递激活 / 梯度），数据量小，对带宽要求低，**非常适合跨节点**（以太网 / IB 也可以）。
- 能降低每卡显存（每卡只放自己那几层）。
- 代价是流水线**气泡**（bubble）空转：`bubble ≈ (PP-1) / (PP-1 + 2×微批次数)`，PP 段数越多、微批次越少，浪费越大；调度也最复杂。

## 四、EP：专家并行

**思路**：专门针对 **MoE（Mixture-of-Experts）** 模型。MoE 把 FFN 层替换成多个「专家」（expert），每个 token 由**门控网络（Router）**挑选 top-k 个专家来计算。EP 就是把众多专家**分布到不同的 GPU** 上，每个专家只处理被路由给它的 token（示意图见下文）。

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

### 三维组合示意（DP2 × PP4 × TP4，共 32 卡）

![3D 并行组合示意](/img/parallel-combine.svg)

图 1 中：

- **横向 4 列 = PP**：模型按层切成 4 段，段间只传激活 / 梯度，微批次流水线执行；
- **每格内 2×2 小格 = TP**：同一层的权重被切到组内 4 卡，组内高频 AllReduce（NVLink）；
- **上下 2 行 = DP**：各持一份完整模型副本，处理不同 batch，每步 AllReduce 同步梯度。

实际部署时，例如 **64 卡 = DP4 × PP4 × TP4**：每 4 张卡组成一个 TP 组（同一台 8 卡机器里放 2 个 TP 组），4 个 TP 组串成流水线，整体再复制 4 份做数据并行。千亿级稠密模型（如 GPT-3 175B 的 Megatron 版本）就是用 `TP8 × PP 数十 × DP 数十` 在几千张卡上训练。

### MoE 模型：叠加 EP

对于 MoE 模型，每个 stage 里的专家层再按 **EP** 切分（Mermaid 示意图）：

图中每个 Token 先经门控网络挑选 top-k 个专家（示意 k 覆盖全部专家，实际通常 k=1~8），再被路由到对应专家所在的卡计算；专家层通信为 All-to-All 的 token 交换。

以 DeepSeek-V3 / Mixtral 这类模型为例，常见组合为 **TP × PP × EP × DP**：节点内先做 TP（张量并行）再叠 EP（专家并行），节点间用 PP 串流水线，最外层 DP 复制多份。EP 与 DP 的区别要分清：DP 的每个副本都有**完整模型**；EP 则是每张卡只有**部分专家**。

实际框架（Megatron-LM、DeepSpeed、vLLM、SGLang 等）都支持任意组合，选型时把握一条主线即可：**把通信最密集的 TP/EP 放在带宽最高的地方，PP 串节点、DP 铺全局**，并根据显存、算力、网络带宽做权衡。
