/* global hexo */
/**
 * hexo-tag-cudadiagram
 *
 * 博客写作用的绘图插件：在文章里用标签生成技术示意图，
 * 风格仿 siboehm.com 的 CUDA-MMM 文章（白底 + 黑色描边 + 高饱和色块），
 * 并且每张图都带"在线编辑"按钮 —— 在 app.diagrams.net 中打开对应的
 * .drawio 文件，可在线编辑后导出回 SVG。
 *
 * 用法（文章 Markdown 中）：
 *   {% cudadiagram mem %}
 *   {% cudadiagram tile m=4 n=4 k=4 tm=2 tn=2 %}
 *
 * 插件在生成时：
 *   1. 渲染内联 SVG（就是文章里显示的图）
 *   2. 把等价的 .drawio 写入 public/diagrams/<name>.drawio，随站点部署
 *   3. 生成编辑链接：https://app.diagrams.net/?offline=1&ui=atlas&url=<部署后的 .drawio 地址>
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { build } = require('./lib/diagrams');

const usedDiagrams = {}; // name -> xml

hexo.extend.tag.register('cudadiagram', args => {
    const type = (args[0] || 'mem').toLowerCase();
    const opts = {};
    for (let i = 1; i < args.length; i++) {
        const m = /^([A-Za-z0-9_]+)=(.+)$/.exec(args[i]);
        if (m) opts[m[1]] = m[2];
    }
    const diagram = build(type, opts);
    usedDiagrams[diagram.name] = diagram.xml;

    const siteUrl = String(hexo.config.url || '').replace(/\/+$/, '');
    const root = String(hexo.config.root || '/').replace(/\/+$/, '');
    const drawioUrl = siteUrl + root + '/diagrams/' + diagram.name + '.drawio';
    const editUrl = 'https://app.diagrams.net/?offline=1&ui=atlas&url='
        + encodeURIComponent(drawioUrl);

    return '<figure style="margin:1.4em 0;padding:14px 14px 10px;border:1px solid #e2e2e2;'
        + 'border-radius:8px;background:#fff;">'
        + '<div style="overflow-x:auto;">' + diagram.svg + '</div>'
        + '<figcaption style="margin-top:8px;font-size:13px;">'
        + '<a href="' + editUrl + '" target="_blank" rel="noopener" '
        + 'style="color:#4060f0;text-decoration:none;font-weight:600;">'
        + '✏️ 在线编辑（draw.io）</a>'
        + '<span style="color:#999;margin-left:10px;">.drawio 源文件已随站点部署，可导出 SVG 更新本文</span>'
        + '</figcaption></figure>';
}, { ends: false });

// 生成结束时，把用到的 .drawio 写入 public/diagrams/（随站点一起部署）
hexo.extend.filter.register('after_generate', () => {
    if (!Object.keys(usedDiagrams).length) return;
    const dir = path.join(hexo.public_dir, 'diagrams');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, xml] of Object.entries(usedDiagrams)) {
        fs.writeFileSync(path.join(dir, name + '.drawio'), xml);
    }
});
