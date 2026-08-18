/**
 * Mermaid 流程图支持（可编辑的示意图）
 *
 * 在文章中这样使用（Mermaid 语法见 https://mermaid.js.org/）：
 *
 * {% mermaid %}
 * flowchart TD
 *     A[输入] --> B{是否合法?}
 *     B -- 是 --> C[处理]
 *     B -- 否 --> D[报错]
 * {% endmermaid %}
 *
 * 原理：文章里出现 {% mermaid %} 时，构建阶段把它输出为
 * <pre class="mermaid"> 代码块；页面加载时通过 CDN 引入 mermaid.js
 * 并渲染成矢量图（SVG）。只有包含 Mermaid 的页面才会加载脚本。
 */

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';

// 1) 注册 {% mermaid %} 标签：内容原样输出，不做 Markdown 转义（ends: true 表示成对块标签）
hexo.extend.tag.register('mermaid', function(args, content) {
    return '<pre class="mermaid">' + content.trim() + '</pre>';
}, { ends: true });

// 2) 页面包含 Mermaid 块时，注入库与初始化脚本（兼容 PJAX 导航）
hexo.extend.filter.register('after_render:html', function(html) {
    if (!html.includes('class="mermaid"')) {
        return html;
    }
    const inject = ''
        + '<script src="' + MERMAID_CDN + '"></script>\n'
        + '<script>\n'
        + '(function() {\n'
        + '    function renderMermaid() {\n'
        + '        var blocks = document.querySelectorAll("pre.mermaid:not(.mermaid-rendered)");\n'
        + '        if (!blocks.length || typeof mermaid === "undefined") return;\n'
        + '        mermaid.initialize({ startOnLoad: false, theme: "default" });\n'
        + '        mermaid.run({ nodes: blocks }).then(function() {\n'
        + '            [].forEach.call(blocks, function(b) { b.classList.add("mermaid-rendered"); });\n'
        + '        });\n'
        + '    }\n'
        + '    document.addEventListener("DOMContentLoaded", renderMermaid);\n'
        + '    document.addEventListener("pjax:complete", renderMermaid);\n'
        + '})();\n'
        + '</script>\n';
    return html.replace('</body>', inject + '</body>');
});
