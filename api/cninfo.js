/**
 * 巨潮资讯网（cninfo.com.cn）公告检索接口
 *
 * 端点: GET https://www.cninfo.com.cn/new/fulltextSearch/full（全文检索，标题 + 公告正文）
 * PDF:  https://static.cninfo.com.cn/{adjunctUrl}（如 finalpage/2026-09-01/1225538073.PDF）
 *
 * ⚠ 实测经验（2026-09，勿凭猜测改参数）：
 * - searchkey 用「证券代码」（如 605499）命中 A 股公告（栏目 SHZB 沪市主板）；
 *   用「公司简称」（如 东鹏饮料）命中港股公告（栏目 HKZB）——检索按全文匹配，
 *   关键词决定命中的市场栏，A+H 公司两边各查一次。type 参数留空即可（实测
 *   type=shmb / type=sse 均返回空，不是有效板块值）。
 * - isfulltext=false 仅按标题/摘要匹配更快；sdate/edate 为 YYYY-MM-DD。
 * - 偶发 5xx / 空结果，重试即可；announcements 为 null 表示 0 命中（非错误）。
 * - announcementTitle 带 <em> 高亮标签，本模块已清洗；announcementTime 为毫秒时间戳。
 */

const SEARCH_URL = 'https://www.cninfo.com.cn/new/fulltextSearch/full';
const STATIC_BASE = 'https://static.cninfo.com.cn/';

/** 由 adjunctUrl 拼 PDF 完整直链 */
export function buildPdfUrl(adjunctUrl) {
  if (!adjunctUrl) return '';
  return adjunctUrl.startsWith('http') ? adjunctUrl : STATIC_BASE + adjunctUrl;
}

/** 清洗标题：去 <em> 高亮标签与常见 HTML 实体 */
function cleanTitle(title) {
  return String(title || '')
    .replace(/<\/?em>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** 毫秒时间戳 → YYYY-MM-DD（本地时区） */
function tsToDate(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Date(n).toISOString().slice(0, 10);
}

/**
 * 检索巨潮公告（单页）
 * @param {string} keyword 检索关键词；建议用证券代码（A 股栏）或公司简称（港股栏），见文件头经验
 * @param {object} [options]
 * @param {string} [options.sdate] 起始日期 YYYY-MM-DD
 * @param {string} [options.edate] 截止日期 YYYY-MM-DD
 * @param {boolean} [options.isfulltext=false] 是否检索公告正文
 * @param {number} [options.pageNum=1]
 * @param {number} [options.pageSize=20]
 * @param {string} [options.type=''] 板块过滤，留空即可（实测其他值返回空）
 * @returns {Promise<{total: number, hasMore: boolean, totalpages: number, announcements: object[]}>}
 *   announcements 项: { title, date, time, secCode, secName, orgId, column, adjunctUrl, pdfUrl }
 */
export async function searchAnnouncements(keyword, options = {}) {
  const {
    sdate = '',
    edate = '',
    isfulltext = false,
    pageNum = 1,
    pageSize = 20,
    type = '',
  } = options;

  if (!keyword || !String(keyword).trim()) {
    throw new Error('searchAnnouncements: keyword 不能为空');
  }

  const query = new URLSearchParams({
    searchkey: String(keyword).trim(),
    sdate,
    edate,
    isfulltext: String(isfulltext),
    sortName: 'pubdate',
    sortType: 'desc',
    pageNum: String(pageNum),
    pageSize: String(pageSize),
    type,
  });

  const response = await fetch(`${SEARCH_URL}?${query.toString()}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Referer: 'https://www.cninfo.com.cn/new/fulltextSearch',
    },
  });

  if (!response.ok) {
    throw new Error(`巨潮接口请求失败: HTTP ${response.status}`);
  }

  const json = await response.json();
  const rows = json.announcements || [];
  return {
    total: json.totalAnnouncement ?? 0,
    hasMore: Boolean(json.hasMore),
    totalpages: json.totalpages ?? 0,
    announcements: rows.map((r) => ({
      title: cleanTitle(r.announcementTitle),
      date: tsToDate(r.announcementTime),
      time: r.announcementTime,
      secCode: r.secCode || '',
      secName: r.secName || '',
      orgId: r.orgId || '',
      column: r.column || '',
      adjunctUrl: r.adjunctUrl || '',
      pdfUrl: buildPdfUrl(r.adjunctUrl),
    })),
  };
}

/**
 * 按标题关键词在多页结果中筛选公告（找"投资者关系活动记录表""业绩说明会"等用）
 * @param {string} keyword 检索关键词（建议证券代码）
 * @param {string|RegExp} titlePattern 标题匹配规则（对清洗后的标题做 test，含即命中）
 * @param {object} [options]
 * @param {number} [options.maxPages=5] 最多翻页数（防止不可控的大查询）
 * @param {number} [options.pageSize=20]
 * @param {string} [options.sdate] 起始日期 YYYY-MM-DD
 * @param {string} [options.edate] 截止日期 YYYY-MM-DD
 * @param {boolean} [options.isfulltext=false]
 * @returns {Promise<{matched: object[], pagesScanned: number, total: number}>}
 */
export async function findAnnouncements(keyword, titlePattern, options = {}) {
  const { maxPages = 5, pageSize = 20, sdate = '', edate = '', isfulltext = false } = options;
  const test = (title) =>
    typeof titlePattern === 'string' ? title.includes(titlePattern) : titlePattern.test(title);

  const matched = [];
  let pagesScanned = 0;
  let total = 0;

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await searchAnnouncements(keyword, { sdate, edate, isfulltext, pageNum, pageSize });
    total = page.total;
    pagesScanned = pageNum;
    for (const row of page.announcements) {
      if (test(row.title)) matched.push(row);
    }
    if (!page.hasMore) break;
  }

  return { matched, pagesScanned, total };
}
