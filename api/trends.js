/**
 * 指数（大盘）分时走势 / 成交量接口（东方财富 push2his）
 *
 * 端点：GET https://push2his.eastmoney.com/api/qt/stock/trends2/get
 *   secid   市场.代码：沪市 1.xxxxxx、深市 0.xxxxxx（与 api/quote.js 的 inferMarket 口径不同，
 *           这里是东财的 market 编号，不要混用）
 *   ndays   返回最近 N 个交易日（实测 1—5 可用）
 *   fields2 分时字段：f51 时间 / f53 收盘（该分钟末价） / f56 成交量 / f57 成交额
 *
 * 返回 data.trends 是一维字符串数组，**多日数据首尾相连**，行格式：
 *   "2026-11-09 09:30,3659.02,4291331,5711010304.00"
 *   即「时间, 价格, 成交量(手), 成交额(元)」。
 *
 * ⚠ 两条实测口径（2026-11-10 核对）：
 *  1. **每个交易日的行数是「分钟数」而非「累计值」**——把某日全部 f56 求和，
 *     得到的就是该日全天成交量（上证指数 11-09 求和 = 4.28 亿手，与快照一致）。
 *     因此「昨日分时量」与「今日分时量」可以直接逐分钟对齐比较，无需再做差分。
 *  2. 交易分钟槽位：09:30—11:30 共 121 个 + 13:01—15:00 共 120 个 = **241 行**
 *     （没有 13:00 这一行，13:01 覆盖 13:00—13:01）；当日未收盘时只有已走出的分钟。
 *
 * CORS：响应头 `access-control-allow-origin` 会回显请求 Origin，浏览器可直连，
 * 与 api/kline.js（腾讯行情）同样是「前端直连、无需代理」的一类接口。
 *
 * 指数口径：上证指数 = 沪市全部，深证综指(399106) = 深市全部（成交额与深证成指一致），
 * 故「沪深两市合计」= 1.000001 + 0.399106 的逐分钟求和。
 */

const TRENDS_URL = 'https://push2his.eastmoney.com/api/qt/stock/trends2/get';

/** 只取本模块用得到的字段：f51 时间、f53 价格、f56 成交量、f57 成交额 */
const FIELDS2 = 'f51,f53,f56,f57';
/** fields1 决定返回的元信息（name / preClose 等），沿用东财前端页面的默认组合 */
const FIELDS1 = 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11';

/** 可选指数：secid 为东财「市场.代码」，aggregate 表示需要多指数逐分钟求和 */
export const INDEX_OPTIONS = [
  { key: 'sh', label: '上证指数', secid: '1.000001', aggregate: false },
  { key: 'sz', label: '深证成指', secid: '0.399001', aggregate: false },
  { key: 'szzz', label: '深证综指', secid: '0.399106', aggregate: false },
  { key: 'sz50', label: '上证50', secid: '1.000016', aggregate: false },
  { key: 'cyb', label: '创业板指', secid: '0.399006', aggregate: false },
  { key: 'hs300', label: '沪深300', secid: '1.000300', aggregate: false },
  { key: 'zz1000', label: '中证1000', secid: '1.000852', aggregate: false },
  { key: 'kc50', label: '科创50', secid: '1.000688', aggregate: false },
  { key: 'bj50', label: '北证50', secid: '0.899050', aggregate: false },
  {
    key: 'all',
    label: '沪深两市',
    name: '沪深两市合计',
    secid: null,
    aggregate: true,
    parts: [
      { secid: '1.000001', label: '沪市' },
      { secid: '0.399106', label: '深市' },
    ],
  },
];

export const getIndexOption = (key) => INDEX_OPTIONS.find((o) => o.key === key) || INDEX_OPTIONS[0];

/** 解析单日分时行 → { time, price, volume, amount } */
function parseRow(line) {
  const p = String(line).split(',');
  if (p.length < 4) return null;
  const time = p[0].slice(11, 16); // "2026-11-09 09:30" → "09:30"
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return { time, price: num(p[1]), volume: num(p[2]), amount: num(p[3]) };
}

/** 一维 trends 数组 → 按交易日分组（保持接口原有顺序） */
export function groupTrendsByDay(trends) {
  const days = [];
  let current = null;
  for (const line of trends || []) {
    const date = String(line).slice(0, 10);
    if (!current || current.date !== date) {
      current = { date, points: [] };
      days.push(current);
    }
    const point = parseRow(line);
    if (point) current.points.push(point);
  }
  return days;
}

/** 拉取单个 secid 的原始分时数据 */
async function fetchTrends(secid, ndays) {
  const query = new URLSearchParams({
    secid,
    fields1: FIELDS1,
    fields2: FIELDS2,
    ndays: String(ndays),
    iscr: '0',
  });
  const res = await fetch(`${TRENDS_URL}?${query.toString()}`, {
    headers: { Referer: 'https://quote.eastmoney.com/' },
  });
  if (!res.ok) throw new Error(`分时接口请求失败：HTTP ${res.status}`);
  const json = await res.json();
  if (!json.data || !Array.isArray(json.data.trends)) {
    throw new Error(`分时接口无数据：${secid}（该指数可能不支持分时或已停牌）`);
  }
  return json.data;
}

/**
 * 多个指数的逐分钟求和（沪深两市合计）
 * 以时间字符串为键对齐；某分钟在任一分项缺失时按已有分项求和（缺失即 0）。
 */
function mergeDays(dayLists) {
  const byDate = new Map();
  dayLists.forEach((days) => {
    days.forEach(({ date, points }) => {
      if (!byDate.has(date)) byDate.set(date, new Map());
      const slot = byDate.get(date);
      points.forEach((p) => {
        const acc = slot.get(p.time) || { time: p.time, price: null, volume: 0, amount: 0 };
        acc.volume += p.volume;
        acc.amount += p.amount;
        slot.set(p.time, acc);
      });
    });
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, slot]) => ({
      date,
      points: [...slot.values()].sort((a, b) => (a.time < b.time ? -1 : 1)),
    }));
}

/**
 * 拉取某个大盘指数的多日分时（含成交量 / 成交额）
 * @param {string} key INDEX_OPTIONS 的 key
 * @param {object} [options]
 * @param {number} [options.ndays=3] 需要的交易日数（取 3 是为了「今日尚未开盘」时仍有 2 个完整日可对比）
 * @returns {Promise<{key:string, name:string, days:Array<{date:string, points:Array}>}>}
 *   days 按日期升序，每项 points 为该日逐分钟 { time, price, volume, amount }
 */
export async function getIndexTrends(key, options = {}) {
  const { ndays = 3 } = options;
  const option = getIndexOption(key);

  if (option.aggregate) {
    const payloads = await Promise.all(option.parts.map((p) => fetchTrends(p.secid, ndays)));
    return {
      key: option.key,
      name: option.name,
      days: mergeDays(payloads.map((d) => groupTrendsByDay(d.trends))),
    };
  }

  const data = await fetchTrends(option.secid, ndays);
  return {
    key: option.key,
    name: data.name || option.label,
    days: groupTrendsByDay(data.trends),
  };
}

export default { getIndexTrends, INDEX_OPTIONS, getIndexOption, groupTrendsByDay };
