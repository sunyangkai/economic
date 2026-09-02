/**
 * 全市场股票筛选器 · 数据层（东方财富 业绩报表 + 腾讯行情）
 *
 * 提供两块批量数据，供筛选程序（scripts/stockScreener.js）使用：
 *
 * 1. 年报营收数据（全市场批量，单次请求最多 500 条）
 *    端点: datacenter-web RPT_LICO_FN_CPD（业绩报表）
 *    服务端过滤 SECURITY_TYPE="A股"，本地再按代码前缀筛出沪深
 *    （6 开头 → 沪，0/3 开头 → 深，排除 4/8/9 开头的北交所/三板）。
 *    营业收入同比 = YSTZ 字段（营业总收入同比增长，单位 %）。
 *
 * 2. 市值数据（腾讯行情批量）
 *    本项目实测 push2.eastmoney.com 不可达，行情统一走 api/quote.js
 *    （腾讯 qt.gtimg.cn），总市值/流通市值单位为亿元。
 *
 * 各函数均为「纯数据获取」，不包含筛选逻辑；筛选/排序由调用方（CLI）完成。
 */

import { fetchReportDataWeb } from './request.js';
import { getQuote } from './quote.js';

/** 沪深 A 股代码判断：6 开头沪市，0/3 开头深市（排除北交所 4/8/9 及三板） */
export function isHsACode(code) {
  return /^(6|0|3)\d{5}$/.test(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 批量拉取某一报告期的沪深 A 股年报营收数据
 * @param {string} reportDate 报告期截止日，如 "2025-12-31"
 * @param {object} [options]
 * @param {number} [options.pageSize=500]
 * @returns {Promise<Array<object>>} [{ code, name, market, totalOperateIncome, yoy }]
 *   - totalOperateIncome: 营业总收入（元）
 *   - yoy: 营业总收入同比增长（%，可能为 null，如次新股无上年数据）
 */
export async function fetchAnnualRevenueRows(reportDate, { pageSize = 500 } = {}) {
  const filter = `(REPORTDATE='${reportDate}')(SECURITY_TYPE="A股")`;
  const rows = [];
  let page = 1;
  let pages = 1;

  do {
    const result = await fetchReportDataWeb(
      'RPT_LICO_FN_CPD',
      'ALL',
      {
        filter,
        pageNumber: page,
        pageSize,
        sortColumns: 'SECURITY_CODE',
        sortTypes: '1',
      }
    );
    pages = result.pages;
    for (const r of result.data || []) {
      if (!isHsACode(r.SECURITY_CODE)) continue;
      rows.push({
        code: r.SECURITY_CODE,
        name: r.SECURITY_NAME_ABBR,
        market: r.TRADE_MARKET,
        totalOperateIncome: r.TOTAL_OPERATE_INCOME,
        yoy: r.YSTZ,
      });
    }
    page += 1;
  } while (page <= pages);

  return rows;
}

/**
 * 批量获取总市值/流通市值（腾讯行情）
 * @param {string[]} codes 6 位证券代码数组（仅沪深）
 * @param {object} [options]
 * @param {number} [options.batchSize=200] 每批请求的代码数
 * @param {number} [options.concurrency=6] 并发批数
 * @param {number} [options.retries=3] 单批失败重试次数
 * @returns {Promise<Map<string, object>>} code -> { totalMv, floatMv }（亿元，缺失为 null）
 */
export async function fetchMarketCapMap(codes, { batchSize = 200, concurrency = 6, retries = 3 } = {}) {
  const map = new Map();
  const batches = [];
  for (let i = 0; i < codes.length; i += batchSize) {
    batches.push(codes.slice(i, i + batchSize));
  }
  if (batches.length === 0) return map;

  let idx = 0;
  let failed = 0;

  const worker = async () => {
    while (idx < batches.length) {
      const batch = batches[idx++];
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          const quotes = await getQuote(batch);
          for (const q of quotes) {
            if (q && q.totalMv != null) {
              map.set(q.code, { totalMv: q.totalMv, floatMv: q.floatMv });
            }
          }
          break;
        } catch (err) {
          if (attempt === retries) {
            failed += 1;
            console.warn(`⚠ 行情获取失败（已重试 ${retries} 次）: ${batch.join(',')} → ${err.message}`);
          } else {
            await sleep(400 * attempt);
          }
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, batches.length) }, () => worker())
  );
  if (failed > 0) console.warn(`⚠ ${failed} 批行情数据获取失败，相关股票将因缺市值被过滤`);
  return map;
}

/** 默认导出：便于 `import api from './stockScreener'` 整体调用 */
const stockScreenerApi = { isHsACode, fetchAnnualRevenueRows, fetchMarketCapMap };

export default stockScreenerApi;
