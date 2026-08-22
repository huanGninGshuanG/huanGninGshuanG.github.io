// 驱动 app.diagrams.net 的无头模式（HeadlessEditorUi）：
// 构造官方无头编辑器 → mxCodec 载入 .drawio XML → graph.getSvg() 导出
const puppeteer = require('puppeteer');
const fs = require('fs');

const xml = fs.readFileSync(process.argv[2], 'utf8');
const outPath = process.argv[3];

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.goto('https://app.diagrams.net/?offline=1', {
        waitUntil: 'domcontentloaded',
        timeout: 90000
    });
    // 等 mxGraph 库与 HeadlessEditorUi 就绪
    await page.waitForFunction(
        'typeof window.HeadlessEditorUi === "function" && typeof window.mxUtils !== "undefined"',
        { timeout: 120000 }
    );
    await new Promise(r => setTimeout(r, 3000));

    const result = await page.evaluate((xml) => {
        const ui = new HeadlessEditorUi();
        const graph = ui.editor.graph;
        const doc = mxUtils.parseXml(xml);
        ui.editor.setGraphXml(doc.documentElement);
        graph.refresh();
        const svgEl = graph.getSvg();
        // 过滤掉空标签的占位符（drawio 无头导出的已知小瑕疵）
        svgEl.querySelectorAll('text').forEach(function (t) {
            if (t.textContent.indexOf('Text is not SVG') !== -1) t.remove();
        });
        let vertices = 0, edges = 0;
        const root = graph.getModel().getRoot();
        const layer = graph.getModel().getChildAt(root, 0);
        for (let i = 0; i < graph.getModel().getChildCount(layer); i++) {
            const c = graph.getModel().getChildAt(layer, i);
            if (graph.getModel().isEdge(c)) edges++; else vertices++;
        }
        return {
            svg: new XMLSerializer().serializeToString(svgEl),
            vertices, edges
        };
    }, xml);

    fs.writeFileSync(outPath, result.svg);
    console.log('exported cells =', result.cells, '| svg length =', result.svg.length);
    await browser.close();
})().catch(e => {
    console.error('FAILED:', e.message);
    process.exit(1);
});
