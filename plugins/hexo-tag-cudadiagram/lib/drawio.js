/**
 * draw.io（mxGraph XML）构建辅助：
 * 生成与 SVG 视觉一致的 .drawio 文件，供"在线编辑"按钮在 app.diagrams.net 中打开。
 * 注意：标签统一用 html=0（纯文本），避免导出 SVG 时的占位符问题。
 */
const { esc } = require('./svg');

function create() {
    return { cells: [], seq: 0 };
}

function vertex(g, id, value, style, x, y, w, h) {
    g.cells.push({ id, value, style, x, y, w, h, vertex: true });
}

function edge(g, id, source, target, style, label) {
    g.cells.push({ id, source, target, style, label: label || '', edge: true });
}

function roundedStyle(fill, opts) {
    opts = opts || {};
    return 'rounded=1;whiteSpace=wrap;html=0;fillColor=' + fill
        + ';strokeColor=#000000;strokeWidth=2;fontSize=' + (opts.fontSize || 13)
        + ';fontStyle=' + (opts.bold === false ? 0 : 1) + ';'
        + (opts.align ? 'align=' + opts.align + ';' : '')
        + (opts.verticalAlign ? 'verticalAlign=' + opts.verticalAlign + ';' : '');
}

function cellStyle(fill) {
    return 'rounded=0;whiteSpace=wrap;html=0;fillColor=' + fill + ';strokeColor=#000000;strokeWidth=1.2;';
}

function textStyle(size) {
    return 'text;html=0;strokeColor=none;fillColor=none;align=center;fontSize=' + (size || 16) + ';fontStyle=1;';
}

function edgeStyle(color) {
    return 'endArrow=block;endFill=1;html=0;strokeColor=' + (color || '#000000')
        + ';strokeWidth=2;fontSize=12;fontStyle=1;';
}

function toString(g, name) {
    let s = '<mxfile host="app.diagrams.net" agent="hexo-tag-cudadiagram" version="26.0.0">'
        + '<diagram id="' + esc(name) + '" name="' + esc(name) + '">'
        + '<mxGraphModel dx="900" dy="700" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" '
        + 'arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="900" math="0" shadow="0">'
        + '<root><mxCell id="0"/><mxCell id="1" parent="0"/>';
    for (const c of g.cells) {
        if (c.vertex) {
            s += '<mxCell id="' + c.id + '" value="' + esc(c.value) + '" style="' + c.style
                + '" vertex="1" parent="1"><mxGeometry x="' + c.x + '" y="' + c.y + '" width="' + c.w
                + '" height="' + c.h + '" as="geometry"/></mxCell>';
        } else {
            s += '<mxCell id="' + c.id + '" value="' + esc(c.label) + '" style="' + c.style
                + '" edge="1" parent="1" source="' + c.source + '" target="' + c.target
                + '"><mxGeometry relative="1" as="geometry"/></mxCell>';
        }
    }
    s += '</root></mxGraphModel></diagram></mxfile>';
    return s;
}

module.exports = { create, vertex, edge, roundedStyle, cellStyle, textStyle, edgeStyle, toString };
