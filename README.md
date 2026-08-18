# 我的博客 — Hexo + Icarus

基于 [Hexo](https://hexo.io/) 与 [Icarus](https://github.com/PPoffice/hexo-theme-icarus) 主题的个人博客，部署于 GitHub Pages：<https://huanGninGshuanG.github.io>

## 分支结构

| 分支 | 内容 |
| --- | --- |
| `main` | 生成的静态网站（默认分支，GitHub Pages 从该分支发布，由 `hexo deploy` 自动推送） |
| `hexo` | Hexo 站点源码（文章、配置、主题配置都提交到这里） |

## 本地开发

```bash
npm install        # 安装依赖
hexo server        # 本地预览，访问 http://localhost:4000
hexo new "文章标题" # 新建文章（Markdown 写在 source/_posts/）
```

## 部署

修改 `_config.yml` / `_config.icarus.yml` / `source/_posts/` 后：

```bash
hexo clean && hexo generate && hexo deploy
```

`hexo deploy` 会把 `public/` 目录推送到远端 `main` 分支，GitHub Pages 会自动更新。

## 文章管理（增删查改）

所有文章都是 `source/_posts/` 下的 Markdown 文件，`hexo new` 只是帮你生成模板，日常操作其实就是「编辑文件 + 重新生成部署」。

| 操作 | 方法 |
| --- | --- |
| **增**（新建） | `hexo new "文章标题"`，然后编辑 `source/_posts/文章标题.md`；也可直接在 `source/_posts/` 下手动创建 `.md` 文件 |
| **查**（查看） | 本地：`hexo server` 后访问 http://localhost:4000；线上：直接访问站点。草稿用 `hexo new draft "标题"` 创建，`hexo server --draft` 本地预览，`hexo publish "标题"` 转为正式文章 |
| **改**（编辑） | 直接改对应 `.md` 文件（标题、日期、tags、categories 在文件头的 Front-Matter 里修改） |
| **删**（删除） | 删除对应的 `.md` 文件即可 |

文章 Front-Matter 示例：

```markdown
---
title: 我的第一篇文章
date: 2025-01-02 10:00:00
tags: [Hexo, 教程]
categories: [技术]
---
正文内容（Markdown）...
```

改完记得重新部署：

```bash
hexo clean && hexo generate && hexo deploy
```

## 目录结构

```
.
├── _config.yml          # 站点主配置（标题、URL、部署目标等）
├── _config.icarus.yml   # Icarus 主题配置（头像、导航、挂件、高亮风格等）
├── package.json         # 依赖清单（hexo、icarus 主题、各插件）
├── package-lock.json    # 依赖锁定文件（npm 自动生成，勿手动改）
├── node_modules/        # 依赖包（npm install 生成，勿手动改）
├── scaffolds/           # 新建文章/页面时的模板（post/page/draft）
├── source/              # 站点源内容（最重要，文章都在这）
│   ├── _posts/          #   文章目录：每个 .md 文件就是一篇文章
│   ├── about/           #   关于页面（source/about/index.md）
│   └── (其他页面/图片等资源)
├── public/              # 生成的静态网站（hexo generate 产出，勿手动改）
├── .deploy_git/         # 部署用的临时 git 仓库（hexo deploy 自动管理）
├── .github/workflows/   # GitHub Actions 自动部署脚本
└── README.md
```

## 主题配置

主题配置在 `_config.icarus.yml`（首次 `hexo generate` 时自动生成），可修改：

- `profile` 挂件：头像、社交链接
- `navbar`：导航菜单
- `code_highlight`：代码高亮风格（支持 90+ 种 highlight.js 主题）
- 评论 / 搜索 / 统计等插件
