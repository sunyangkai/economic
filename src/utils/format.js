/** 展示层格式化工具（纯函数） */

/** 价格：保留两位小数；空值显示 — */
export const fmtPrice = (v, digits = 2) =>
  v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(digits);

/** 涨跌幅：带正负号，形如 +1.23% */
export const fmtPct = (v, digits = 2) =>
  v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(digits)}%`;

/** 成交量：手 → 万手 / 亿手 */
export function fmtVolume(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿手`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万手`;
  return `${n.toFixed(0)}手`;
}

/** 成交额：万元 → 亿元 / 万元 */
export function fmtAmount(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}亿元`;
  return `${n.toFixed(2)}万元`;
}

/** 涨跌色：A 股惯例 —— 涨红、跌绿、平灰（深色主题配色，与 KlineChart 的 UP / DOWN 保持一致） */
export function trendColor(change) {
  if (change == null || !Number.isFinite(Number(change))) return '#8b93a1';
  if (Number(change) > 0) return '#ef5350';
  if (Number(change) < 0) return '#1fc08f';
  return '#8b93a1';
}

/** 代码输入容错：去掉空格、允许 600887 / sh600887 / 600887.SH 等写法 */
export function normalizeInput(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/^(\d{5,6})\.(SH|SZ|BJ)$/i, (_, code, mkt) => `${mkt.toLowerCase()}${code}`)
    .toLowerCase();
}
