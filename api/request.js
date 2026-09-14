/**
 * 东方财富数据中心通用请求工具
 *
 * 供各接口封装文件（mainFinanceData.js / balanceSheet.js / incomeStatement.js /
 * cashFlowStatement.js / companyEvents.js 等）复用。
 *
 * 东财接口有三种查询方式，分别提供对应的方法：
 * - fetchDataCenter   财务报表类(v0)：result 包含 { pages, count, data }，用 filter/sty 查询
 * - fetchDetailData   大事/详情类：顶层 data 为数组的数组(按类型分组)，用 params 查询、hasNext 翻页
 * - fetchReportData   报表类(v1)：响应结构同 fetchDataCenter，用 reportName/columns 查询
 *
 * ⚠ 浏览器直接调用可能受 CORS 限制，开发期可借助 devServer proxy 转发，
 *   或通过服务端（node/后端）调用。
 */

/** 接口地址（v0，财务报表/大事类） */
const BASE_URL = 'https://datacenter.eastmoney.com/securities/api/data/get';

/** 接口地址（v1，报表类：reportName/columns 查询） */
const BASE_URL_V1 = 'https://datacenter.eastmoney.com/securities/api/data/v1/get';

/** 接口地址（v1，数据中心 WEB 版，部分报表如 RPT_HOLDERNUMLATEST 只在此域名返回全量历史） */
const BASE_URL_WEB_V1 = 'https://datacenter-web.eastmoney.com/api/data/v1/get';

/**
 * 发送请求并校验响应
 * @param {string} url 完整请求地址
 * @returns {Promise<object>} 解析后的完整响应 JSON
 */
async function request(url) {
  const response = await fetch(url, {
    headers: { Referer: 'https://emweb.securities.eastmoney.com/' },
  });

  if (!response.ok) {
    throw new Error(`东方财富接口请求失败: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(`东方财富接口返回错误: ${json.message || json.code}`);
  }

  return json;
}

/**
 * 通用请求方法（财务报表类接口）：调用 datacenter 的 /api/data/get
 * @param {string} type 数据类型，如 RPT_F10_FINANCE_GINCOME
 * @param {string} sty  返回样式
 * @param {object} [params] 其他查询参数（p/ps/sr/st/filter 等，可覆盖默认值）
 * @returns {Promise<object>} 解析后的 result: { pages, count, data }
 */
export async function fetchDataCenter(type, sty, params = {}) {
  const query = new URLSearchParams({
    type,
    sty,
    quoteColumns: '',
    p: '1',
    ps: '200',
    sr: '-1',
    st: 'REPORT_DATE',
    source: 'HSF10',
    client: 'PC',
    v: buildVersionParam(),
    ...params,
  });

  const json = await request(`${BASE_URL}?${query.toString()}`);
  return json.result;
}

/**
 * 通用请求方法（v1 报表类接口）：调用 /api/data/v1/get
 * 响应结构与 fetchDataCenter 相同（result 含 pages/count/data），
 * 但请求参数命名不同：reportName/columns/pageNumber/pageSize/sortTypes/sortColumns。
 * @param {string} reportName 报表名，如 RPT_HSF10_RES_ORGPREDICT
 * @param {string|string[]} columns 返回字段，数组自动 join 成逗号串
 * @param {object} [params] 其他查询参数（filter/pageNumber/pageSize 等，可覆盖默认值）
 * @param {string} [baseUrl=BASE_URL_V1] 接口地址，默认 securities 域名；传 BASE_URL_WEB_V1 可查 WEB 版报表
 * @returns {Promise<object>} 解析后的 result: { pages, count, data }
 */
export async function fetchReportData(
  reportName,
  columns,
  params = {},
  baseUrl = BASE_URL_V1
) {
  const query = new URLSearchParams({
    reportName,
    columns: Array.isArray(columns) ? columns.join(',') : columns,
    quoteColumns: '',
    pageNumber: '1',
    pageSize: '200',
    sortTypes: '',
    sortColumns: '',
    source: 'HSF10',
    client: 'PC',
    v: buildVersionParam(),
    ...params,
  });

  const json = await request(`${baseUrl}?${query.toString()}`);
  return json.result;
}

/** WEB 版 v1 报表接口（与 fetchReportData 同构，仅换域名） */
export function fetchReportDataWeb(reportName, columns, params = {}) {
  return fetchReportData(reportName, columns, params, BASE_URL_WEB_V1);
}

/**
 * 通用请求方法（大事/详情类接口）：响应结构与财务报表类不同
 * @param {string} type 数据类型，如 RTP_F10_ADVANCE_DETAIL_NEW
 * @param {string} params 查询参数串，如 "300760.SZ;100,110,120,..."
 * @param {object} [options]
 * @param {number} [options.page=1] 页码，配合返回的 hasNext 翻页
 * @returns {Promise<object>} { data, hasNext }，data 为数组的数组（按事件类型分组）
 */
export async function fetchDetailData(type, params, { page = 1 } = {}) {
  const query = new URLSearchParams({
    type,
    params,
    p: page,
    source: 'HSF10',
    client: 'PC',
    v: buildVersionParam(),
  });

  const json = await request(`${BASE_URL}?${query.toString()}`);
  return { data: json.data, hasNext: json.hasNext };
}

/**
 * 构建 filter 查询串
 * - 标量值 → (KEY="value")，如 (SECUCODE="300760.SZ")
 * - 数组值 → (KEY in ('a','b'))，如 (REPORT_DATE in ('2025-12-31','2024-12-31'))
 * @param {object} fields 字段名 -> 值，空值/空数组会被忽略
 * @returns {string}
 */
export function buildFilter(fields) {
  return Object.entries(fields)
    .filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
    )
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `(${key} in (${value.map((v) => `'${v}'`).join(',')}))`;
      }
      return `(${key}="${value}")`;
    })
    .join('');
}

/**
 * 构建证券过滤条件：北交所股票（.BJ / 4、8、9 开头）用 SECURITY_CODE（无后缀），
 * 其余市场用 SECUCODE（含后缀）——东财财务报表类报表对 BJ 股票仅支持 SECURITY_CODE 过滤。
 * @param {string} seccode 证券代码，如 "300760.SZ" / "430047.BJ"
 * @param {object} [extra] 其他过滤字段，如 { REPORT_TYPE: '年报' }
 * @returns {string} buildFilter 生成的过滤串
 */
export function buildSecFilter(seccode, extra = {}) {
  const raw = String(seccode).trim();
  const upper = raw.toUpperCase();
  const bare = raw.replace(/\.\w+$/, '');
  const isBJ = upper.endsWith('.BJ') || /^[489]/.test(bare);
  const fields = isBJ ? { SECURITY_CODE: bare, ...extra } : { SECUCODE: raw, ...extra };
  return buildFilter(fields);
}

/** 回落告警去重集合：同一进程内每个"未指定报告期"的调用点只警告一次，避免刷屏 */
const warnedFallbacks = new Set();

/**
 * 解析报告期列表：优先 years，其次 reportDates，**都未传时回落到最近 5 个年报日**。
 *
 * ⚠ 回落是"静默"的历史行为，也是最容易踩的坑（2026-09-12 实测踩坑，勿重犯）：
 *   调用三表接口（`api/incomeStatement.js` / `api/balanceSheet.js` /
 *   `api/cashFlowStatement.js`）时它们**没有 `reportType` 选项**，传
 *   `{ reportType: '中报' }` 或 `{ reportType: '' }` 都会被静默丢弃、不会报错，
 *   本函数收不到 reportDates/years，于是回落成 5 期**年报**——调用方以为拿到
 *   季报/中报，实际拿到年报，错误会一路传进同比、净现比与估值。
 *   要季报/中报口径，必须显式传 `reportDates: ['2026-06-30', ...]`。
 *
 * 为让回落不再完全无声，回落到年报日时会打一条一次性 console.warn（按调用点去重，
 * 不改变返回值、不影响既有默认行为）。
 *
 * @param {object} input { reportDates?, years? }
 * @param {object} [context] { caller? } 调用方名称，仅用于告警文案定位
 * @returns {string[]} 形如 ['2025-12-31','2024-12-31',...]
 */
export function resolveReportDates({ reportDates, years } = {}, { caller } = {}) {
  if (Array.isArray(years) && years.length > 0) {
    return years.map((y) => `${y}-12-31`);
  }
  if (Array.isArray(reportDates) && reportDates.length > 0) {
    return reportDates;
  }
  const key = caller || 'resolveReportDates';
  if (!warnedFallbacks.has(key)) {
    warnedFallbacks.add(key);
    console.warn(
      `[api/request] ${key}：未传 reportDates/years，已回落到最近 ${5} 个年报日（12-31）。` +
      '若本意是取季报/中报，请显式传 reportDates（三表接口不支持 reportType 选项，传了会被静默忽略）。',
    );
  }
  return defaultAnnualDates(5);
}

/**
 * 生成最近 N 个已完成年度的年报截止日（12-31）
 * @param {number} count 取最近几年
 * @returns {string[]}
 */
function defaultAnnualDates(count) {
  const lastCompletedYear = new Date().getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => `${lastCompletedYear - i}-12-31`);
}

/**
 * 生成与前端一致的版本号参数，用于绕过接口缓存
 * 形如 "0<时间戳><5位随机数>"，如 09194510786329041
 */
function buildVersionParam() {
  return `0${Date.now()}${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
}
