/**
 * 视觉风格：仿 siboehm.com CUDA-MMM 文章的示意图风格。
 * 特征：白底、黑色描边与文字、高饱和色块。
 */
module.exports = {
    // 字体栈（含中文回退）
    font: "'Helvetica Neue', Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    // 主描边 / 文字颜色
    stroke: '#000000',
    text: '#000000',
    // 高饱和配色（蓝 / 橙 / 紫 / 青 / 黄 / 绿）
    palette: ['#4060f0', '#e07000', '#802090', '#10a0b0', '#f0b000', '#509000'],
    // 内存层级图配色（黄 / 绿 / 浅蓝 / 浅蓝紫）
    memColors: {
        registers: '#f0c000',
        smem: '#90d050',
        l2: '#a0d0f0',
        dram: '#b0e0f0'
    }
};
