/**
 * 单只股票「资产负债表」接口（东方财富 F10）
 *
 * 端点: GET https://datacenter.eastmoney.com/securities/api/data/get
 * 类型: type=RPT_F10_FINANCE_GBALANCE & sty=F10_FINANCE_GBALANCE
 *
 * ⚠ 浏览器直接调用可能受 CORS 限制，开发期可借助 devServer proxy 转发，
 *   或通过服务端（node/后端）调用。
 *
 * ── 响应数据结构（实测）────────────────────────────────────────────
 * {
 *   "version": "b3d2cf2b...",   // 接口版本号
 *   "success": true,            // 是否成功
 *   "code": 0,                  // 错误码，0 为成功
 *   "message": "ok",            // 提示信息
 *   "result": {
 *     "pages": 2,               // 总页数
 *     "count": 5,               // 记录总数（报告期条数）
 *     "data": [                 // 资产负债表记录数组，按 st/sr 排序
 *       { "SECUCODE": "300760.SZ", "REPORT_DATE": "2025-12-31 00:00:00", "TOTAL_ASSETS": 59266767707, ... }
 *     ]
 *   }
 * }
 *
 * ── data[] 记录字段说明（实测非银企业；银行/保险/券商专用字段为 null）────
 * 每个科目字段都带对应的 *_YOY 字段（同比变动，%），如 TOTAL_ASSETS_YOY。
 *
 * 【基础信息】
 *   SECUCODE            证券代码(含市场后缀)，如 "300760.SZ"
 *   SECURITY_CODE       证券代码，如 "300760"
 *   SECURITY_NAME_ABBR  证券简称，如 "迈瑞医疗"
 *   ORG_CODE / ORG_TYPE 机构代码 / 机构类型(通用)
 *   REPORT_DATE         报告期截止日期，如 "2025-12-31 00:00:00"
 *   REPORT_TYPE         报告类型：年报 / 中报 / 一季报 / 三季报
 *   REPORT_DATE_NAME    报告期名称，如 "2025年报"
 *   NOTICE_DATE         公告日期
 *   UPDATE_DATE         数据更新日期
 *   CURRENCY            币种，如 "CNY"
 *   OPINION_TYPE        审计意见，如 "标准无保留意见"
 *   LISTING_STATE       上市状态，如 "0"
 *
 * 【资产】(元)
 *   MONETARYFUNDS          货币资金
 *   NOTE_RECE              应收票据
 *   ACCOUNTS_RECE          应收账款
 *   NOTE_ACCOUNTS_RECE     应收票据及应收账款
 *   FINANCE_RECE           应收款项融资
 *   PREPAYMENT             预付款项
 *   OTHER_RECE             其他应收款
 *   INVENTORY              存货
 *   CONTRACT_ASSET         合同资产
 *   OTHER_CURRENT_ASSET    其他流动资产
 *   TOTAL_CURRENT_ASSETS   流动资产合计
 *   TRADE_FINASSET         交易性金融资产
 *   LONG_EQUITY_INVEST     长期股权投资
 *   INVEST_REALESTATE      投资性房地产
 *   FIXED_ASSET            固定资产
 *   CIP                    在建工程
 *   USERIGHT_ASSET         使用权资产
 *   INTANGIBLE_ASSET       无形资产
 *   DEVELOP_EXPENSE        开发支出
 *   GOODWILL               商誉
 *   DEFER_TAX_ASSET        递延所得税资产
 *   OTHER_NONCURRENT_ASSET 其他非流动资产
 *   TOTAL_NONCURRENT_ASSETS 非流动资产合计
 *   TOTAL_ASSETS           资产总计
 *
 * 【负债】(元)
 *   SHORT_LOAN             短期借款
 *   NOTE_PAYABLE           应付票据
 *   ACCOUNTS_PAYABLE       应付账款
 *   NOTE_ACCOUNTS_PAYABLE  应付票据及应付账款
 *   CONTRACT_LIAB          合同负债
 *   STAFF_SALARY_PAYABLE   应付职工薪酬
 *   TAX_PAYABLE            应交税费
 *   OTHER_CURRENT_LIAB     其他流动负债
 *   TOTAL_CURRENT_LIAB     流动负债合计
 *   LONG_LOAN              长期借款
 *   BOND_PAYABLE           应付债券
 *   LEASE_LIAB             租赁负债
 *   PREDICT_LIAB           预计负债
 *   DEFER_TAX_LIAB         递延所得税负债
 *   OTHER_NONCURRENT_LIAB  其他非流动负债
 *   TOTAL_NONCURRENT_LIAB  非流动负债合计
 *   TOTAL_LIABILITIES      负债合计
 *
 * 【所有者权益】(元)
 *   SHARE_CAPITAL          实收资本(股本)
 *   CAPITAL_RESERVE        资本公积
 *   SURPLUS_RESERVE        盈余公积
 *   OTHER_COMPRE_INCOME    其他综合收益
 *   UNASSIGN_RPOFIT        未分配利润
 *   TREASURY_SHARES        库存股
 *   TOTAL_PARENT_EQUITY    归属于母公司股东权益合计
 *   MINORITY_EQUITY        少数股东权益
 *   TOTAL_EQUITY           所有者权益合计
 *
 * 【总计】
 *   TOTAL_LIAB_EQUITY      负债和所有者权益总计
 *   (TOTAL_ASSETS === TOTAL_LIAB_EQUITY，可校验数据完整性)
 *
 * 注: 银行/保险/券商专用字段（如 ACCEPT_DEPOSIT_INTERBANK、LOAN_ADVANCE、
 *     INSURANCE_CONTRACT_RESERVE 等）通用(非金融)企业返回 null，可忽略。
 */

import { fetchDataCenter, buildSecFilter, resolveReportDates } from './request.js';

/**
 * 查询单只股票的资产负债表（支持多个报告期）
 * @param {string} seccode 证券代码，如 "300760.SZ"
 * @param {object} [options]
 * @param {string[]} [options.reportDates] 报告期日期数组，如 ['2025-12-31','2024-12-31']，
 *                                         通过 filter 的 REPORT_DATE in (...) 查询
 * @param {number[]}  [options.years]      年份数组，如 [2025, 2024]，自动转成各年 12-31 日期
 * @param {number}    [options.page=1]
 * @param {number}    [options.pageSize=200]
 * @param {string}    [options.sortBy='REPORT_DATE']
 * @param {number}    [options.sortOrder=-1]
 * @returns {Promise<object>} { pages, count, data }，data 为资产负债表记录数组
 *
 * 默认 reportDates 为最近 5 个已完成年度报告的 12-31 日期；
 * reportDates 与 years 同时给出时优先用 years。
 */
export function getStockBalanceSheet(seccode, options = {}) {
  const {
    reportDates,
    years,
    page = 1,
    pageSize = 200,
    sortBy = 'REPORT_DATE',
    sortOrder = -1,
  } = options;

  const filter = buildSecFilter(seccode, {
    REPORT_DATE: resolveReportDates({ reportDates, years }),
  });

  return fetchDataCenter('RPT_F10_FINANCE_GBALANCE', 'F10_FINANCE_GBALANCE', {
    filter,
    p: page,
    ps: pageSize,
    sr: sortOrder,
    st: sortBy,
  });
}

/** 默认导出：便于 `import api from './balanceSheet'` 整体调用 */
const balanceSheetApi = { getStockBalanceSheet };

export default balanceSheetApi;
