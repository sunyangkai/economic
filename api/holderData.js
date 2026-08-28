/**
 * 单只股票「股东结构」接口（东方财富 F10 datacenter）
 *
 * 本模块封装三类股东数据：
 * 1. 股东户数趋势  RPT_HOLDERNUM_DET     —— 判断筹码集中/分散的核心指标（WEB 版报表）
 * 2. 前十大流通股东 RPT_F10_EH_FREEHOLDERS —— "八、流通股东变化"的逐期对比
 * 3. 前十大股东    RPT_F10_EH_HOLDERS    —— "七、治理结构"的控制权与集中度
 *
 * 端点: 东方财富 datacenter（v1 报表接口，走 api/request.js 现有封装，请求头/参数/错误处理一致）
 *
 * ── 1) 股东户数 RPT_HOLDERNUM_DET 字段 ──────────────────────────────
 *   END_DATE          报告期截止日，如 "2026-03-31"
 *   HOLDER_NUM        股东户数
 *   HOLDER_NUM_CHANGE 户数变动
 *   HOLDER_NUM_RATIO  户数变动率(%)
 *   AVG_HOLD_NUM      户均持股数
 *   AVG_MARKET_CAP    户均持股金额(市值口径, 元)
 *   HOLD_NOTICE_DATE  公告日期
 *
 * ── 2) 前十大流通股东 RPT_F10_EH_FREEHOLDERS 字段 ───────────────────
 *   END_DATE          报告期截止日
 *   HOLDER_RANK       名次
 *   HOLDER_NAME       股东名称
 *   HOLD_RATIO        持股占总股本比例(%)
 *   HOLDER_TYPE       股东类型（其它 / 全国社保基金 / 证券投资基金 / QFII 等）
 *   HOLD_CHANGE       变动（增持/减持/不变/新进）
 *   HOLD_RATIO_CHANGE 持股比例变动(pp)
 *
 * ── 3) 前十大股东 RPT_F10_EH_HOLDERS 字段 ───────────────────────────
 *   END_DATE          报告期截止日
 *   HOLDER_RANK       名次
 *   HOLDER_NAME       股东名称
 *   HOLD_NUM_RATIO    持股占总股本比例(%)
 *   HOLD_NUM          持股数
 *   HOLD_NUM_CHANGE   持股数变动
 *   CHANGE_RATIO      变动比例(%)
 *
 * ⚠ 用法：先按报告期(END_DATE)分组，再逐期列出前十大；历史数据量较大时 pageSize 传大值（如 500）。
 */

import { fetchReportData, fetchReportDataWeb, buildFilter } from './request.js';

/** 按 SECURITY_CODE 过滤 + 报告期倒序的公共参数 */
function buildCommonParams(seccode, { pageSize = 200 } = {}) {
  return {
    filter: buildFilter({ SECURITY_CODE: String(seccode).replace(/\.(SZ|SH|BJ)$/i, '') }),
    sortColumns: 'END_DATE',
    sortTypes: '-1',
    pageSize,
  };
}

/**
 * 查询股东户数历史趋势
 * @param {string} seccode 证券代码，如 "300760" / "300760.SZ"
 * @param {object} [options] { pageSize=500 }
 * @returns {Promise<object[]>} data 数组，按报告期倒序（最新在前）
 */
export async function getHolderNumberTrend(seccode, options = {}) {
  const { pageSize = 500 } = options;
  const result = await fetchReportDataWeb('RPT_HOLDERNUM_DET', 'ALL', {
    ...buildCommonParams(seccode, { pageSize }),
    source: 'WEB',
    client: 'WEB',
  });
  return result.data || [];
}

/**
 * 查询前十大流通股东（全历史报告期）
 * @param {string} seccode 证券代码，如 "300760" / "300760.SZ"
 * @param {object} [options] { pageSize=200 }
 * @returns {Promise<object[]>} data 数组，按报告期倒序、期内按名次排列
 */
export async function getTopFreeHolders(seccode, options = {}) {
  const result = await fetchReportData('RPT_F10_EH_FREEHOLDERS', 'ALL', buildCommonParams(seccode, options));
  return result.data || [];
}

/**
 * 查询前十大股东（全历史报告期）
 * @param {string} seccode 证券代码，如 "300760" / "300760.SZ"
 * @param {object} [options] { pageSize=200 }
 * @returns {Promise<object[]>} data 数组，按报告期倒序、期内按名次排列
 */
export async function getTopHolders(seccode, options = {}) {
  const result = await fetchReportData('RPT_F10_EH_HOLDERS', 'ALL', buildCommonParams(seccode, options));
  return result.data || [];
}

/**
 * 把股东明细按报告期分组，返回 Map<END_DATE, rows[]>
 * @param {object[]} rows getTopFreeHolders / getTopHolders 返回的数组
 * @returns {Map<string, object[]>} 按报告期分组（日期字符串为 key）
 */
export function groupHoldersByDate(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = String(r.END_DATE || '').slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

/**
 * 计算各报告期的前 N 大集中度（用于筹码集中度趋势）
 * @param {object[]} rows 股东明细
 * @param {number} [topN=10]
 * @returns {Array<{ date: string, topN: number }>} 按报告期升序
 */
export function calcConcentrationTrend(rows, topN = 10) {
  const byDate = groupHoldersByDate(rows);
  const ratioKey = rows[0] && 'HOLD_RATIO' in rows[0] ? 'HOLD_RATIO' : 'HOLD_NUM_RATIO';
  return [...byDate.entries()]
    .map(([date, list]) => ({
      date,
      topN: +list
        .slice(0, topN)
        .reduce((s, r) => s + (Number(r[ratioKey]) || 0), 0)
        .toFixed(2),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** 默认导出：便于 `import api from './holderData'` 整体调用 */
const holderDataApi = {
  getHolderNumberTrend,
  getTopFreeHolders,
  getTopHolders,
  groupHoldersByDate,
  calcConcentrationTrend,
};

export default holderDataApi;
