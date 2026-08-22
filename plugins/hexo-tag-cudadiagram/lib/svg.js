/**
 * SVG 构建辅助：无依赖、无 id 冲突（箭头用多边形绘制，不用 marker/defs）。
 */
const style = require('./style');

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function svgDoc(w, h, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '"'
        + ' font-family="' + style.font + '" role="img" style="max-width:100%;height:auto;">'
        + inner + '</svg>';
}

function rect(x, y, w, h, o) {
    o = o || {};
    const fill = o.fill || '#ffffff';
    const stroke = o.stroke || style.stroke;
    const sw = o.sw || 2;
    const rx = o.rx || 0;
    let s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '"'
        + ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"';
    if (o.opacity) s += ' opacity="' + o.opacity + '"';
    s += '/>';
    return s;
}

function text(x, y, s, o) {
    o = o || {};
    const size = o.size || 14;
    const anchor = o.anchor || 'middle';
    const fill = o.fill || style.text;
    return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="' + anchor + '"'
        + ' font-weight="' + (o.bold ? 'bold' : 'normal') + '" fill="' + fill + '">' + esc(s) + '</text>';
}

/** 带箭头线段（箭头为实心多边形，无需 defs/marker，多图共存无 id 冲突） */
function arrow(x1, y1, x2, y2, o) {
    o = o || {};
    const stroke = o.stroke || style.stroke;
    const sw = o.sw || 2;
    const L = 11;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const bx = x2 - L * Math.cos(ang);
    const by = y2 - L * Math.sin(ang);
    const p1x = bx + 5 * Math.cos(ang + Math.PI / 2);
    const p1y = by + 5 * Math.sin(ang + Math.PI / 2);
    const p2x = bx + 5 * Math.cos(ang - Math.PI / 2);
    const p2y = by + 5 * Math.sin(ang - Math.PI / 2);
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"'
        + ' stroke="' + stroke + '" stroke-width="' + sw + '"/>'
        + '<polygon points="' + x2 + ',' + y2 + ' ' + p1x.toFixed(1) + ',' + p1y.toFixed(1) + ' '
        + p2x.toFixed(1) + ',' + p2y.toFixed(1) + '" fill="' + stroke + '"/>';
}

module.exports = { esc, svgDoc, rect, text, arrow };
