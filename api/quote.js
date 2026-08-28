/**
 * 单只/多只股票「实时行情」接口（腾讯行情 qt.gtimg.cn）
 *
 * 端点: GET https://qt.gtimg.cn/q=sz300760
 * 响应: GBK 编码的文本，每只股票一行，形如：
 *   v_sz300760="51~迈瑞医疗~300760~164.03~162.03~161.38~39314~...~20260828114542~2.00~1.23~164.75~161.23~..."
 *   字段以 ~ 分隔（见下方字段表），多个代码用逗号拼接、多行返回。
 *
 * ⚠ 说明：
 * - 东财 push2 行情域名在本环境不可达（实测 fetch failed），腾讯 qt.gtimg.cn 稳定可用；
 *   本模块是行情数据的唯一入口，不要在其他地方自行拼接行情请求。
 * - 响应为 GBK 编码：Node 内置 TextDecoder('gbk')（full-icu）可直接解码，无需 iconv-lite。
 * - 支持 A 股（sz/sh/bj 前缀）、港股（hk 前缀）、美股（us 前缀，字段略有差异）。
 *
 * ── 字段映射（split('~') 后按 0 基索引，A 股标准格式）─────────────────
 *   [1] 名称        [2] 代码        [3] 现价          [4] 昨收
 *   [5] 今开        [6] 成交量(手)  [7] 外盘          [8] 内盘
 *   [9~29] 买五/卖五档
 *   [30] 时间(yyyyMMddHHmmss)  [31] 涨跌额   [32] 涨跌幅(%)  [33] 最高   [34] 最低
 *   [35] 价/量/额    [36] 成交量(手)  [37] 成交额(万元)  [38] 换手率(%)
 *   [39] 市盈率TTM   [43] 振幅(%)     [44] 流通市值(亿元) [45] 总市值(亿元)
 *   [46] 市净率PB    [47] 涨停价      [48] 跌停价        [49] 量比
 *
 * ── 返回对象 ──────────────────────────────────────────────────────
 * {
 *   code: "300760", name: "迈瑞医疗", market: "sz",
 *   price: 164.03, prevClose: 162.03, open: 161.38,
 *   high: 164.75, low: 161.23, change: 2.00, changePct: 1.23,
 *   volume: 39314, amount: 64022,         // 手 / 万元
 *   turnoverRate: 0.32, peTtm: 25.36, pb: 5.15, amplitude: 2.17,
 *   floatMv: 1985.85, totalMv: 1987.71,   // 亿元
 *   limitUp: 194.44, limitDown: 129.62, volumeRatio: 0.86,
 *   timestamp: "20260828114542", raw: [...]  // raw 为完整字段数组
 * }
 */

/** 依据证券代码推断市场前缀（A 股：6 开头沪市、0/3 开头深市、4/8/9 开头北交所；其余按显式前缀） */
export function inferMarket(seccode) {
  const code = String(seccode).toLowerCase();
  if (/^[0-9]{5,6}$/.test(code)) {
    if (code.startsWith('6')) return 'sh';
    if (code.startsWith('0') || code.startsWith('3')) return 'sz';
    if (code.startsWith('4') || code.startsWith('8') || code.startsWith('9')) return 'bj';
    return 'sh';
  }
  if (code.startsWith('sh') || code.startsWith('sz') || code.startsWith('bj')) return code.slice(0, 2);
  if (code.startsWith('hk')) return 'hk';
  if (code.startsWith('us')) return 'us';
  throw new Error(`无法推断市场前缀: ${seccode}（请传入如 "300760" / "600000" / "sz300760" / "hk00700"）`);
}

/** 规范化证券代码为 "市场前缀+代码"（如 "sz300760"） */
export function normalizeSecid(seccode) {
  const code = String(seccode).trim();
  if (/^(sh|sz|bj|hk|us)/i.test(code)) return code.toLowerCase();
  return `${inferMarket(code)}${code}`;
}

/** 解析单行行情文本（形如 v_sz300760="...~...";） */
export function parseQuoteLine(line) {
  const match = line.match(/="(.*)"\s*;?$/);
  if (!match) return null;
  const f = match[1].split('~');
  if (f.length < 50 || !f[1]) return null;
  const num = (i) => {
    const v = Number(f[i]);
    return Number.isFinite(v) && f[i] !== '' ? v : null;
  };
  return {
    code: f[2],
    name: f[1],
    price: num(3),
    prevClose: num(4),
    open: num(5),
    high: num(33),
    low: num(34),
    change: num(31),
    changePct: num(32),
    volume: num(36),           // 手
    amount: num(37),           // 万元
    turnoverRate: num(38),     // %
    peTtm: num(39),
    amplitude: num(43),        // %
    floatMv: num(44),          // 亿元
    totalMv: num(45),          // 亿元
    pb: num(46),
    limitUp: num(47),
    limitDown: num(48),
    volumeRatio: num(49),
    timestamp: f[30],
    raw: f,
  };
}

/**
 * 查询实时行情
 * @param {string|string[]} seccode 证券代码，如 "300760" / "600000" / "sz300760" / "hk00700"，或数组批量查询
 * @returns {Promise<object|object[]>} 单代码返回对象，多代码返回对象数组（按传入顺序）
 */
export async function getQuote(seccode) {
  const codes = Array.isArray(seccode) ? seccode : [seccode];
  const query = codes.map(normalizeSecid).join(',');
  const response = await fetch(`https://qt.gtimg.cn/q=${query}`, {
    headers: { Referer: 'https://gu.qq.com/' },
  });
  if (!response.ok) {
    throw new Error(`腾讯行情接口请求失败: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const text = new TextDecoder('gbk').decode(buffer);
  const quotes = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseQuoteLine)
    .filter(Boolean);
  if (quotes.length === 0) {
    throw new Error(`腾讯行情接口无数据: ${query}`);
  }
  return Array.isArray(seccode) ? quotes : quotes[0];
}

/** 默认导出：便于 `import api from './quote'` 整体调用 */
const quoteApi = { getQuote, parseQuoteLine, inferMarket, normalizeSecid };

export default quoteApi;
