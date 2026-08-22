# diagrams.net（draw.io）绘图

本目录是用 **app.diagrams.net** 绘制的图：

| 文件 | 说明 |
| --- | --- |
| `publish-flow.drawio` | 可编辑源文件，在 https://app.diagrams.net 打开即可编辑 |
| `publish-flow.svg` | 由 diagrams.net 渲染导出的矢量图（可直接放进 `source/img/` 用于文章） |
| `export-svg.js` | 无头导出脚本：用 Puppeteer 驱动 app.diagrams.net 把 .drawio 渲染成 SVG |

## 日常编辑流程（推荐，不需要脚本）

1. 打开 https://app.diagrams.net → File → Open → 选择 `publish-flow.drawio`
2. 编辑完成后 File → Export as → **SVG**（或 PNG），覆盖 `publish-flow.svg`
3. 需要发文章时把 SVG 复制到 `source/img/`，在文章里 `![](/img/publish-flow.svg)` 引用

## 无头批量导出（可选）

```bash
npm i puppeteer    # 需要 Chrome，会自动下载
node diagrams/export-svg.js diagrams/publish-flow.drawio output.svg
```

脚本原理：用无头 Chromium 打开 app.diagrams.net → 用应用自身的
`HeadlessEditorUi` + `setGraphXml` 载入 XML → `graph.getSvg()` 导出，
并过滤掉 drawio 无头导出的空标签占位符。

## 说明

- `.drawio` 本质是 mxGraph XML，格式与网页应用完全一致，100% 可编辑
- 已确认在 hexo 构建时可正常被引用（SVG 直接复制到 `source/img/` 即可）
