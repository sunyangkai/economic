/**
 * K 线数据接口（腾讯行情）
 *
 * 三个端点，**均在响应头返回 `access-control-allow-origin: *`**（2026-09-14 实测），
 * 因此浏览器可直连，不需要 devServer 代理：
 *
 *  1. 日 / 周 / 月线（支持前复权 qfq、后复权 hfq、不复权）：
 *     GET https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=<code>,<period>,<start>,<end>,<count>,<fq>
 *     返回 data.<code>.qfqday / hfqday / day（周线为 qfqweek / week，月线 qfqmonth / month）
 *     每行 = [日期, 开, 收, 高, 低, 成交量(手)]
 *     同一响应里还带 `qt` 快照（实时行情）与 `prec`（昨收），字段版式同下。
 *
 *  2. 分钟线（m1 / m5 / m15 / m30 / m60，仅不复权）：
 *     GET https://ifzq.gtimg.cn/appstock/app/kline/mkline?param=<code>,<period>,,<count>
 *     返回 data.<code>.m5 等，每行 = [时间(yyyyMMddHHmm), 开, 收, 高, 低, 成交量(手), {}, 金额?]
 *     ⚠ 注意与日线**路径不同**（web.ifzq vs ifzq）；日线端点不接受分钟周期（返回 code:1 bad params）。
 *
 *  3. 实时快照（GBK 文本，需 TextDecoder('gbk')）：
 *     GET https://qt.gtimg.cn/q=<code>
 *     字段映射见 `api/quote.js`（本文件的解析与该模块口径保持一致）。
 *
 * 代码前缀：6 开头 → sh，0/3 → sz，另有 hk / us 显式前缀（北交所 bj 不在支持范围内）。
 *
 * ⚠ 复权参数**只对 sh/sz 个股生效**：指数、港股、美股无论传什么复权参数，
 *   返回的键名都是不带前缀的 day / week / month（这些品种本身也无复权价）。
 *   故取数时按「带前缀 → 无前缀」兜底，并把实际生效的复权口径回传给 UI，避免界面
 *   显示"前复权"而数据其实是不复权（2026-09-14 实测）。
 */

const KLINE_URL = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get';
const MINUTE_URL = 'https://ifzq.gtimg.cn/appstock/app/kline/mkline';
const QUOTE_URL = 'https://qt.gtimg.cn/q=';

/** 周期选项 → 接口参数。kind 区分日线端点（fqkline）与分钟线端点（mkline） */
export const PERIODS = [
  { key: 'day', label: '日K', kind: 'day', api: 'day' },
  { key: 'week', label: '周K', kind: 'day', api: 'week' },
  { key: 'month', label: '月K', kind: 'day', api: 'month' },
  { key: 'm1', label: '1分', kind: 'minute', api: 'm1' },
  { key: 'm5', label: '5分', kind: 'minute', api: 'm5' },
  { key: 'm15', label: '15分', kind: 'minute', api: 'm15' },
  { key: 'm30', label: '30分', kind: 'minute', api: 'm30' },
  { key: 'm60', label: '60分', kind: 'minute', api: 'm60' },
];

/** 复权选项（分钟线接口只有不复权数据，故 UI 需按周期禁用该开关） */
export const ADJUSTS = [
  { key: 'qfq', label: '前复权', prefix: 'qfq' },
  { key: 'hfq', label: '后复权', prefix: 'hfq' },
  { key: 'none', label: '不复权', prefix: '' },
];

export const getPeriod = (key) => PERIODS.find((p) => p.key === key) || PERIODS[0];

/** 分钟线天生无复权数据，复权开关对它无意义 */
export const supportsAdjust = (periodKey) => getPeriod(periodKey).kind === 'day';

/** 依据证券代码推断市场前缀（口径参考 api/quote.js 的 inferMarket；北交所不在支持范围） */
export function inferMarket(seccode) {
  const code = String(seccode).trim().toLowerCase();
  if (/^[0-9]{5,6}$/.test(code)) {
    if (code.startsWith('6')) return 'sh';
    if (code.startsWith('0') || code.startsWith('3')) return 'sz';
    // 4/8/9 开头为北交所代码，本页面不提供支持，交由下方统一报错
  }
  const explicit = code.match(/^(sh|sz|hk|us)/);
  if (explicit) return explicit[0];
  if (code.startsWith('bj')) {
    throw new Error(`暂不支持北交所代码：${seccode}（本页面仅支持沪深 A 股、指数与港股 / 美股）`);
  }
  throw new Error(
    /^[489]/.test(code)
      ? `暂不支持北交所代码：${seccode}（本页面仅支持沪深 A 股、指数与港股 / 美股）`
      : `无法识别的证券代码：${seccode}（例：600887 / sz300760 / hk00700）`,
  );
}

/** 规范化证券代码为「市场前缀 + 代码」，如 600887 → sh600887 */
export function normalizeSecid(seccode) {
  const code = String(seccode).trim();
  if (/^(sh|sz|hk|us)/i.test(code)) return code.toLowerCase();
  return `${inferMarket(code)}${code}`;
}

/** 从 "sh600887" 反解出展示用代码 "600887" */
export function displayCode(secid) {
  return String(secid).replace(/^(sh|sz|hk|us)/i, '');
}

/**
 * 解析腾讯行情文本行（v_sh600887="1~伊利股份~600887~26.80~..."）
 * 字段索引口径与项目 api/quote.js 一致，此处只取 K 线页面需要的字段。
 */
function parseQuoteLine(line) {
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
    pb: num(46),
    totalMv: num(45),          // 亿元
    floatMv: num(44),          // 亿元
    timestamp: f[30],
  };
}

/** 请求 K 线原始 JSON */
async function fetchKlineJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`K 线接口请求失败：HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`K 线接口返回错误：${json.msg || json.code}`);
  return json.data || {};
}

/**
 * 拉取 K 线
 * @param {string} seccode 证券代码，如 "600887" / "sh600887" / "hk00700"
 * @param {object} [options]
 * @param {string} [options.period='day'] PERIODS 中的 key
 * @param {string} [options.adjust='qfq'] ADJUSTS 中的 key（分钟线自动忽略）
 * @param {number} [options.count=320] 拉取条数（1 分钟线接口实测最多约 320 条）
 * @returns {Promise<{secid:string, name:string, period:string, adjust:string,
 *   candles:Array<{date:string, open:number, close:number, high:number, low:number, volume:number}>,
 *   quote:object|null, prevClose:number|null}>}
 *   adjust          = 实际生效的复权口径（指数/港股/美股会降级为 none）
 *   requestedAdjust = 调用方请求的复权口径（用于界面提示"该品种无复权数据"）
 */
export async function getKline(seccode, options = {}) {
  const { period = 'day', adjust = 'qfq', count = 320 } = options;
  const secid = normalizeSecid(seccode);
  const periodDef = getPeriod(period);
  const adjDef = ADJUSTS.find((a) => a.key === adjust) || ADJUSTS[0];
  const useAdjust = supportsAdjust(period) ? adjDef.prefix : '';

  const url = periodDef.kind === 'minute'
    ? `${MINUTE_URL}?param=${secid},${periodDef.api},,${count}`
    : `${KLINE_URL}?param=${secid},${periodDef.api},,,${count},${useAdjust}`;

  const data = await fetchKlineJson(url);
  const node = data[secid];
  if (!node) throw new Error(`未找到证券 ${secid} 的行情数据，请检查代码是否正确`);

  // ── 数据 key 兜底 ────────────────────────────────────────────────
  // 实测（2026-09-14）：只有 sh/sz 的**个股**会按复权参数返回 qfqday / hfqday；
  // 指数（sh000001）、港股（hk00700）、美股一律只返回不带前缀的
  // `day` / `week` / `month`（且这些品种本身也无复权价）。因此按"带复权前缀 → 无前缀"
  // 依次尝试，取第一个有效数组。
  const keyCandidates = periodDef.kind === 'minute'
    ? [periodDef.api]
    : [`${useAdjust}${periodDef.api}`, periodDef.api];

  let rows = null;
  let usedKey = null;
  for (const k of keyCandidates) {
    if (Array.isArray(node[k]) && node[k].length > 0) {
      rows = node[k];
      usedKey = k;
      break;
    }
  }
  if (!rows) {
    throw new Error(`证券 ${secid} 无 ${periodDef.label} 数据（该代码可能已停牌或退市）`);
  }
  // 请求了复权但只拿到无前缀数据 → 该品种（指数 / 港股 / 美股）不支持复权
  const adjustApplied = /^(qfq|hfq)/.test(usedKey) ? useAdjust : '';

  const candles = rows.map((r) => {
    const rawDate = String(r[0]);
    return {
      // 分钟线时间为 yyyyMMddHHmm，格式化后展示
      date: periodDef.kind === 'minute'
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)} ${rawDate.slice(8, 10)}:${rawDate.slice(10, 12)}`
        : rawDate,
      open: Number(r[1]),
      close: Number(r[2]),
      high: Number(r[3]),
      low: Number(r[4]),
      volume: Number(r[5]),
    };
  }).filter((c) => Number.isFinite(c.open) && Number.isFinite(c.close));

  // 接口实测会多返回 1 行（请求 800 → 返回 801），按请求条数截断到尾部 count 根
  const trimmed = candles.length > count ? candles.slice(candles.length - count) : candles;

  const quoteNode = node.qt && Object.values(node.qt)[0];
  const quote = Array.isArray(quoteNode)
    ? parseQuoteLine(`v_x="${quoteNode.join('~')}";`)
    : null;

  return {
    secid,
    name: quote?.name || displayCode(secid),
    period,
    adjust: adjustApplied ? adjDef.key : 'none',
    requestedAdjust: adjDef.key,
    candles: trimmed,
    quote,
    prevClose: Number.isFinite(Number(node.prec)) ? Number(node.prec) : null,
  };
}

/** 拉取实时快照（单只） */
export async function getSnapshot(seccode) {
  const secid = normalizeSecid(seccode);
  const res = await fetch(`${QUOTE_URL}${secid}`);
  if (!res.ok) throw new Error(`行情快照请求失败：HTTP ${res.status}`);
  const text = new TextDecoder('gbk').decode(await res.arrayBuffer());
  const quote = parseQuoteLine(text.trim());
  if (!quote) throw new Error(`行情快照无数据：${secid}`);
  return quote;
}

export default { getKline, getSnapshot, normalizeSecid, inferMarket, PERIODS, ADJUSTS };
