# hexo-tag-cudadiagram

Hexo 绘图插件：在文章中用标签生成技术示意图，风格仿
[siboehm.com 的 CUDA-MMM 文章](https://siboehm.com/articles/22/CUDA-MMM)
（白底、黑色描边、高饱和色块），并且每张图都带**在线编辑**按钮：
点击后在 app.diagrams.net 中打开对应的 `.drawio` 源文件，可在线编辑并导出 SVG 更新文章。

## 安装

站点 `package.json` 中已包含：

```json
"hexo-tag-cudadiagram": "file:plugins/hexo-tag-cudadiagram"
```

插件代码位于 `plugins/hexo-tag-cudadiagram/`。

## 用法

文章 Markdown 中：

```
{% cudadiagram mem %}

{% cudadiagram tile m=4 n=4 k=4 tm=2 tn=2 %}
```

| 类型 | 说明 | 参数 |
| --- | --- | --- |
| `mem` | GPU 内存层级图（寄存器 / 共享内存 / L2 / DRAM） | `title=自定义标题` |
| `tile` | 矩阵分块图（Block Tiling） | `m=4 n=4 k=4 tm=2 tn=2` |

## 工作方式

1. 构建时（tag）渲染内联 SVG 作为文章里的图
2. `after_generate` 钩子把等价的 `.drawio` 写入 `public/diagrams/<name>.drawio`，随站点部署
3. 每张图下方生成编辑链接：`https://app.diagrams.net/?offline=1&ui=atlas&url=<站点上的 .drawio 地址>`

> 注意：app.diagrams.net 通过其服务端代理抓取 `url` 指向的文件，所以必须是
> **公网可访问的 https 地址**（站点部署后即满足）。本地预览时编辑按钮的 URL
> 指向线上域名，需部署后生效。

## 自定义

- 配色与字体：`lib/style.js`（仿 CUDA-MMM 风格）
- 新增图形类型：在 `lib/diagrams.js` 增加一个 builder（同时返回 `svg` 与 `xml`）
- SVG / draw.io 构建辅助：`lib/svg.js`、`lib/drawio.js`
