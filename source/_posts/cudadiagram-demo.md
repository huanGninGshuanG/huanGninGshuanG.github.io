---
title: 绘图插件演示：可在线编辑的技术示意图
date: 2026-08-19 09:00:00
updated: 2026-08-19 09:00:00
tags:
  - Hexo
  - 插件
  - 示意图
categories:
  - 技术
---

本博客集成了自研的 **hexo-tag-cudadiagram** 绘图插件：用标签在文章中生成技术示意图，风格参考 siboehm.com 的 CUDA 矩阵乘文章（白底 + 黑色描边 + 高饱和色块），并且**每张图都可以在线编辑** —— 点击图下方的"✏️ 在线编辑（draw.io）"按钮，会打开 app.diagrams.net 并载入对应的 `.drawio` 源文件，改完导出 SVG 即可更新文章。

## 一、GPU 内存层级图

{% cudadiagram mem %}

用法：`{% cudadiagram mem %}`

## 二、矩阵分块图（Block Tiling）

{% cudadiagram tile m=4 n=4 k=4 tm=2 tn=2 %}

用法：`{% cudadiagram tile m=4 n=4 k=4 tm=2 tn=2 %}`（`m/n/k` 为矩阵块数，`tm/tn` 为 tile 尺寸）

## 工作原理

1. 构建时插件渲染内联 SVG（就是上图），并生成等价的 `.drawio` 文件部署到 `/diagrams/`
2. 编辑按钮打开 `app.diagrams.net/?url=<站点上的 .drawio 地址>`，图形自动载入
3. 在网页版编辑后 File → Export as → SVG，替换文章图片即可

插件源码在仓库 `plugins/hexo-tag-cudadiagram/`，可自行扩展新的图形类型。
