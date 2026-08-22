/**
 * 图形构建器：每种图形同时产出
 *  - svg：文章内联展示的矢量图（siboehm CUDA-MMM 风格）
 *  - xml：对应的 .drawio 文件内容（用于"在线编辑"）
 */
const svg = require('./svg');
const d = require('./drawio');
const style = require('./style');

/* ===================== 1. GPU 内存层级图 ===================== */

function memoryHierarchy(opts) {
    const W = 720, H = 560;
    const title = opts.title || 'GPU 内存层级（Memory Hierarchy）';
    const levels = [
        { name: '寄存器 Registers', sub: '每线程私有 · 最快 · 容量最小', color: style.memColors.registers },
        { name: '共享内存 Shared Memory', sub: 'Block 内共享 · ~30 TB/s 级', color: style.memColors.smem },
        { name: 'L2 缓存 L2 Cache', sub: 'GPU 内共享 · ~12 TB/s 级', color: style.memColors.l2 },
        { name: '显存 DRAM', sub: '全局 · ~2 TB/s 级', color: style.memColors.dram }
    ];
    const bx = 140, bw = 440, bh = 76, gap = 36, y0 = 120;
    let inner = '';
    inner += svg.text(W / 2, 40, title, { size: 22, bold: true });
    // 左侧快慢标注
    inner += svg.text(96, y0 + 24, '快 · 小', { size: 13, anchor: 'end' });
    inner += svg.text(96, y0 + 3 * (bh + gap) + 52, '慢 · 大', { size: 13, anchor: 'end' });
    for (let i = 0; i < levels.length; i++) {
        const y = y0 + i * (bh + gap);
        inner += svg.rect(bx, y, bw, bh, { fill: '#ffffff', rx: 10 });
        inner += svg.text(bx + bw / 2, y + 32, levels[i].name, { size: 17, bold: true });
        inner += svg.text(bx + bw / 2, y + 56, levels[i].sub, { size: 12.5 });
        if (i < levels.length - 1) {
            const y2 = y + bh + gap;
            inner += svg.arrow(bx + bw / 2, y + bh + 2, bx + bw / 2, y2 - 2, { sw: 2.5 });
        }
    }
    inner += svg.text(W / 2, H - 34, '数据需逐级搬运：DRAM → L2 → 共享内存 → 寄存器', { size: 13 });
    const svgStr = svg.svgDoc(W, H, inner);

    // drawio 版本
    const g = d.create();
    d.vertex(g, 'title', title, d.textStyle(20), 120, 20, 480, 30);
    d.vertex(g, 'fast', '快 · 小', d.textStyle(13), 20, y0 + 20, 90, 24);
    d.vertex(g, 'slow', '慢 · 大', d.textStyle(13), 20, y0 + 3 * (bh + gap) + 46, 90, 24);
    for (let i = 0; i < levels.length; i++) {
        const y = y0 + i * (bh + gap);
        d.vertex(g, 'lvl' + i, levels[i].name + '\n' + levels[i].sub,
            d.roundedStyle('#ffffff', { fontSize: 14 }), bx, y, bw, bh);
        if (i < levels.length - 1) {
            d.edge(g, 'arr' + i, 'lvl' + i, 'lvl' + (i + 1), d.edgeStyle());
        }
    }
    d.vertex(g, 'note', '数据需逐级搬运：DRAM → L2 → 共享内存 → 寄存器', d.textStyle(13), 120, H - 60, 480, 26);
    const xml = d.toString(g, 'mem');

    return { svg: svgStr, xml, name: 'mem', width: W, height: H };
}

/* ===================== 2. 矩阵分块图（Block Tiling） ===================== */

function matrixTiling(opts) {
    const M = intOpt(opts.m, 4), N = intOpt(opts.n, 4), K = intOpt(opts.k, 4);
    const tm = Math.min(intOpt(opts.tm, 2), M);
    const tn = Math.min(intOpt(opts.tn, 2), N);
    const W = 880, H = 660;
    const cell = 24, pitch = 26;
    const A = { x: 70, y: 190, rows: M, cols: K };   // M×K
    const B = { x: 570, y: 190, rows: K, cols: N };  // K×N
    const C = { x: 320, y: 430, rows: M, cols: N };  // M×N
    const colBlue = style.palette[0];    // #4060f0
    const colOrange = style.palette[1];  // #e07000
    const colPurple = style.palette[2];  // #802090

    function grid(gd) {
        let s = '';
        for (let r = 0; r < gd.rows; r++) {
            for (let c = 0; c < gd.cols; c++) {
                s += svg.rect(gd.x + c * pitch, gd.y + r * pitch, cell, cell, { sw: 1.2 });
            }
        }
        return s;
    }

    let inner = '';
    inner += svg.text(W / 2, 40, '矩阵分块计算（Block Tiling）', { size: 22, bold: true });
    inner += svg.text(W / 2, 70, 'C 的每个 tile = A 的行块 × B 的列块 的累加；块放入共享内存复用', { size: 13 });
    // 三个矩阵
    inner += grid(A); inner += svg.text(A.x + (K * pitch) / 2, A.y - 14, 'A：M×K', { size: 15, bold: true });
    inner += grid(B); inner += svg.text(B.x + (N * pitch) / 2, B.y - 14, 'B：K×N', { size: 15, bold: true });
    inner += grid(C); inner += svg.text(C.x + (N * pitch) / 2, C.y - 14, 'C：M×N', { size: 15, bold: true });
    // tile 高亮：白底 + 彩色粗描边（保留颜色语义，无背景填充）
    inner += svg.rect(A.x, A.y, tm * pitch - 2, tm * pitch - 2, { fill: '#ffffff', stroke: colBlue, sw: 3.5 });
    inner += svg.rect(B.x, B.y, tn * pitch - 2, tm * pitch - 2, { fill: '#ffffff', stroke: colOrange, sw: 3.5 });
    inner += svg.rect(C.x, C.y, tn * pitch - 2, tm * pitch - 2, { fill: '#ffffff', stroke: colPurple, sw: 3.5 });
    // 箭头：A tile → C tile，B tile → C tile
    inner += svg.arrow(A.x + K * pitch + 6, A.y + tm * pitch / 2, C.x - 6, C.y + tm * pitch / 2, { stroke: colBlue, sw: 2.5 });
    inner += svg.arrow(B.x + 4, B.y + tm * pitch + 6, C.x + N * pitch - 4, C.y - 6, { stroke: colOrange, sw: 2.5 });
    inner += svg.text((A.x + K * pitch + C.x) / 2 - 10, C.y + tm * pitch / 2 - 8, 'A 的 tile', { size: 12.5, fill: colBlue, bold: true });
    inner += svg.text((B.x + C.x + N * pitch) / 2, C.y - 16, 'B 的 tile', { size: 12.5, fill: colOrange, bold: true });
    inner += svg.text(C.x + N * pitch + 30, C.y + tm * pitch / 2, '+= A_tile × B_tile', { size: 13, bold: true });
    const svgStr = svg.svgDoc(W, H, inner);

    // drawio 版本
    const g = d.create();
    d.vertex(g, 'title', '矩阵分块计算（Block Tiling）', d.textStyle(20), 140, 20, 600, 30);
    d.vertex(g, 'sub', 'C 的每个 tile = A 的行块 × B 的列块 的累加；块放入共享内存复用', d.textStyle(13), 140, 55, 600, 26);
    let aid = 0;
    for (const [prefix, gd] of [['a', A], ['b', B], ['c', C]]) {
        for (let r = 0; r < gd.rows; r++) {
            for (let c = 0; c < gd.cols; c++) {
                d.vertex(g, prefix + '_' + r + '_' + c, '', d.cellStyle('#ffffff'),
                    gd.x + c * pitch, gd.y + r * pitch, cell, cell);
                aid++;
            }
        }
    }
    const tileStyle = c => 'rounded=1;whiteSpace=wrap;html=0;fillColor=#ffffff;strokeColor=' + c + ';strokeWidth=3;fontSize=11;fontStyle=1;';
    d.vertex(g, 'atile', 'A tile', tileStyle(colBlue), A.x, A.y, tm * pitch - 2, tm * pitch - 2);
    d.vertex(g, 'btile', 'B tile', tileStyle(colOrange), B.x, B.y, tn * pitch - 2, tm * pitch - 2);
    d.vertex(g, 'ctile', 'C tile', tileStyle(colPurple), C.x, C.y, tn * pitch - 2, tm * pitch - 2);
    d.edge(g, 'e1', 'atile', 'ctile', d.edgeStyle(colBlue), 'A 的 tile');
    d.edge(g, 'e2', 'btile', 'ctile', d.edgeStyle(colOrange), 'B 的 tile');
    const name = 'tile-' + M + '-' + N + '-' + K + '-' + tm + '-' + tn;
    const xml = d.toString(g, name);

    return { svg: svgStr, xml, name, width: W, height: H };
}

/* ===================== 3. FFN（SwiGLU）结构图 ===================== */

function ffnDiagram(opts) {
    const W = 840, H = 520;
    const title = opts.title || 'FFN（SwiGLU）结构';
    const formula = 'down_proj( SwiGlu(gate(X)) · up_proj(X) )';
    const X = { x: 30, y: 210, w: 150, h: 80, fill: '#ffffff' };
    const gate = { x: 250, y: 100, w: 180, h: 70, fill: '#ffffff' };
    const swiglu = { x: 480, y: 100, w: 140, h: 70, fill: '#ffffff' };
    const up = { x: 250, y: 290, w: 180, h: 70, fill: '#ffffff' };
    const mul = { x: 576, y: 216, r: 34, fill: '#ffffff' };
    const down = { x: 480, y: 380, w: 200, h: 70, fill: '#ffffff' };
    const out = { x: 720, y: 380, w: 100, h: 70, fill: '#ffffff' };

    let inner = '';
    inner += svg.text(W / 2, 36, title, { size: 20, bold: true });
    inner += svg.text(W / 2, 62, formula, { size: 13 });

    function box(b, name, dim) {
        let s = svg.rect(b.x, b.y, b.w, b.h, { fill: b.fill, rx: 10 });
        s += svg.text(b.x + b.w / 2, b.y + 28, name, { size: 15, bold: true });
        s += svg.text(b.x + b.w / 2, b.y + 52, dim, { size: 12 });
        return s;
    }
    inner += box(X, 'X', '[bs, seq_len, dim]');
    inner += box(gate, 'gate 门控', '[intermediate, dim]');
    inner += box(swiglu, 'SwiGlu', '激活函数');
    inner += box(up, 'up_proj', '[intermediate, dim]');
    inner += box(down, 'down_proj', '[dim, intermediate]');
    inner += box(out, '输出', '[bs, seq_len, dim]');
    // 逐元素相乘 ⊗
    inner += '<circle cx="' + mul.x + '" cy="' + mul.y + '" r="' + mul.r + '" fill="' + mul.fill
        + '" stroke="' + style.stroke + '" stroke-width="2"/>';
    inner += svg.text(mul.x, mul.y + 5, '⊗', { size: 22, bold: true });
    // 箭头
    inner += svg.arrow(X.x + X.w + 4, X.y + 18, gate.x - 4, gate.y + 32, { sw: 2.5 });
    inner += svg.arrow(X.x + X.w + 4, X.y + X.h - 18, up.x - 4, up.y + 32, { sw: 2.5 });
    inner += svg.arrow(gate.x + gate.w, gate.y + gate.h / 2, swiglu.x, swiglu.y + gate.h / 2, { sw: 2.5 });
    inner += svg.arrow(swiglu.x + swiglu.w / 2, swiglu.y + swiglu.h, mul.x - 12, mul.y - 6, { sw: 2.5 });
    inner += svg.arrow(up.x + up.w, up.y + up.h / 2 + 6, mul.x - 12, mul.y + 10, { sw: 2.5 });
    inner += svg.arrow(mul.x + 8, mul.y + 18, down.x + down.w / 2 - 20, down.y - 4, { sw: 2.5 });
    inner += svg.arrow(down.x + down.w, down.y + down.h / 2, out.x, out.y + down.h / 2, { sw: 2.5 });
    // 表达式标注
    inner += svg.text(515, 205, 'SwiGlu(gate(X))', { size: 11, fill: style.palette[2] });
    inner += svg.text(455, 296, 'up_proj(X)', { size: 11, fill: style.palette[3] });
    const svgStr = svg.svgDoc(W, H, inner);

    // drawio 版本
    const g = d.create();
    d.vertex(g, 'title', title, d.textStyle(18), 160, 16, 520, 30);
    d.vertex(g, 'formula', formula, d.textStyle(13), 160, 50, 520, 24);
    d.vertex(g, 'x', 'X\n[bs, seq_len, dim]', d.roundedStyle(X.fill, { fontSize: 14 }), X.x, X.y, X.w, X.h);
    d.vertex(g, 'gate', 'gate 门控\n[intermediate, dim]', d.roundedStyle(gate.fill, { fontSize: 14 }), gate.x, gate.y, gate.w, gate.h);
    d.vertex(g, 'swiglu', 'SwiGlu\n激活函数', d.roundedStyle(swiglu.fill, { fontSize: 14 }), swiglu.x, swiglu.y, swiglu.w, swiglu.h);
    d.vertex(g, 'up', 'up_proj\n[intermediate, dim]', d.roundedStyle(up.fill, { fontSize: 14 }), up.x, up.y, up.w, up.h);
    d.vertex(g, 'mul', '⊗', 'ellipse;whiteSpace=wrap;html=0;fillColor=' + mul.fill + ';strokeColor=#000000;strokeWidth=2;fontSize=20;', mul.x - mul.r, mul.y - mul.r, mul.r * 2, mul.r * 2);
    d.vertex(g, 'down', 'down_proj\n[dim, intermediate]', d.roundedStyle(down.fill, { fontSize: 14 }), down.x, down.y, down.w, down.h);
    d.vertex(g, 'out', '输出\n[bs, seq_len, dim]', d.roundedStyle(out.fill, { fontSize: 14 }), out.x, out.y, out.w, out.h);
    d.edge(g, 'e1', 'x', 'gate', d.edgeStyle());
    d.edge(g, 'e2', 'x', 'up', d.edgeStyle());
    d.edge(g, 'e3', 'gate', 'swiglu', d.edgeStyle());
    d.edge(g, 'e4', 'swiglu', 'mul', d.edgeStyle(), 'SwiGlu(gate(X))');
    d.edge(g, 'e5', 'up', 'mul', d.edgeStyle(), 'up_proj(X)');
    d.edge(g, 'e6', 'mul', 'down', d.edgeStyle());
    d.edge(g, 'e7', 'down', 'out', d.edgeStyle());
    const xml = d.toString(g, 'ffn');

    return { svg: svgStr, xml, name: 'ffn', width: W, height: H };
}

/* ===================== 入口 ===================== */

function intOpt(v, def) {
    const n = parseInt(v, 10);
    return isFinite(n) && n > 0 ? n : def;
}

function build(type, opts) {
    if (type === 'mem') return memoryHierarchy(opts);
    if (type === 'tile') return matrixTiling(opts);
    if (type === 'ffn') return ffnDiagram(opts);
    throw new Error('diagram: 未知图形类型 "' + type + '"（支持 mem / tile / ffn）');
}

module.exports = { build };
