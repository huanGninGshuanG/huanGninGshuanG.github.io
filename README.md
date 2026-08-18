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

## 主题配置

主题配置在 `_config.icarus.yml`（首次 `hexo generate` 时自动生成），可修改：

- `profile` 挂件：头像、社交链接
- `navbar`：导航菜单
- `code_highlight`：代码高亮风格（支持 90+ 种 highlight.js 主题）
- 评论 / 搜索 / 统计等插件
