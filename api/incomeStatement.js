/**
 * 单只股票「利润表」接口（东方财富 F10）
 *
 * 端点: GET https://datacenter.eastmoney.com/securities/api/data/get
 * 类型: type=RPT_F10_FINANCE_GINCOME & sty=APP_F10_GINCOME
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
 *     "data": [                 // 利润表记录数组，按 st/sr 排序
 *       { "SECUCODE": "300760.SZ", "REPORT_DATE": "2025-12-31 00:00:00", "TOTAL_OPERATE_INCOME": 33282159404, ... }
 *     ]
 *   }
 * }
 *
 * ── data[] 记录字段说明（实测非银企业；银行/保险/券商专用字段为 null）────
 * 每个科目字段都带对应的 *_YOY 字段（同比变动，%），如 OPERATE_INCOME_YOY。
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
 *
 * 【收入与成本】(元)
 *   TOTAL_OPERATE_INCOME 营业总收入
 *   OPERATE_INCOME       营业收入
 *   TOTAL_OPERATE_COST   营业总成本
 *   OPERATE_COST         营业成本
 *   OPERATE_TAX_ADD      税金及附加
 *   SALE_EXPENSE         销售费用
 *   MANAGE_EXPENSE       管理费用
 *   RESEARCH_EXPENSE     研发费用
 *   FINANCE_EXPENSE      财务费用
 *     FE_INTEREST_EXPENSE  其中：利息费用
 *     FE_INTEREST_INCOME   其中：利息收入
 *   OTHER_BUSINESS_INCOME 其他业务收入
 *   OTHER_BUSINESS_COST   其他业务成本
 *
 * 【减值与利得】(元)
 *   ASSET_IMPAIRMENT_LOSS    资产减值损失（旧口径）
 *   CREDIT_IMPAIRMENT_LOSS   信用减值损失（旧口径）
 *   ASSET_IMPAIRMENT_INCOME  资产减值损失（新口径，损失记负值）
 *   CREDIT_IMPAIRMENT_INCOME 信用减值损失（新口径）
 *   FAIRVALUE_CHANGE_INCOME  公允价值变动收益
 *   INVEST_INCOME            投资收益
 *   INVEST_JOINT_INCOME      其中：对联营/合营企业投资收益
 *   ASSET_DISPOSAL_INCOME    资产处置收益
 *   OTHER_INCOME             其他收益
 *
 * 【利润】(元)
 *   OPERATE_PROFIT        营业利润
 *   NONBUSINESS_INCOME    营业外收入
 *   NONBUSINESS_EXPENSE   营业外支出
 *   TOTAL_PROFIT          利润总额
 *   INCOME_TAX            所得税费用
 *   NETPROFIT             净利润
 *   CONTINUED_NETPROFIT   持续经营净利润
 *   DISCONTINUED_NETPROFIT 终止经营净利润
 *   PARENT_NETPROFIT      归属于母公司股东的净利润
 *   MINORITY_INTEREST     少数股东损益
 *   DEDUCT_PARENT_NETPROFIT 扣非归母净利润
 *
 * 【每股指标】(元)
 *   BASIC_EPS    基本每股收益
 *   DILUTED_EPS  稀释每股收益
 *
 * 【综合收益】(元)
 *   OTHER_COMPRE_INCOME  其他综合收益
 *   PARENT_OCI           归母其他综合收益
 *   MINORITY_OCI         少数股东其他综合收益
 *   TOTAL_COMPRE_INCOME  综合收益总额
 *   PARENT_TCI           归母综合收益总额
 *   MINORITY_TCI         少数股东综合收益总额
 *
 * 注: 银行/保险/券商专用字段（INTEREST_INCOME、EARNED_PREMIUM、
 *     FEE_COMMISSION_INCOME 等）通用(非金融)企业返回 null，可忽略。
 */

import { fetchDataCenter, buildFilter, resolveReportDates } from './request.js';

/**
 * 查询单只股票的利润表（支持多个报告期）
 * @param {string} seccode 证券代码，如 "300760.SZ"
 * @param {object} [options]
 * @param {string[]} [options.reportDates] 报告期日期数组，如 ['2025-12-31','2024-12-31']，
 *                                         通过 filter 的 REPORT_DATE in (...) 查询
 * @param {number[]}  [options.years]      年份数组，如 [2025, 2024]，自动转成各年 12-31 日期
 * @param {number}    [options.page=1]
 * @param {number}    [options.pageSize=200]
 * @param {string}    [options.sortBy='REPORT_DATE']
 * @param {number}    [options.sortOrder=-1]
 * @returns {Promise<object>} { pages, count, data }，data 为利润表记录数组
 *
 * 默认 reportDates 为最近 5 个已完成年度报告的 12-31 日期；
 * reportDates 与 years 同时给出时优先用 years。
 */
export function getStockIncomeStatement(seccode, options = {}) {
  const {
    reportDates,
    years,
    page = 1,
    pageSize = 200,
    sortBy = 'REPORT_DATE',
    sortOrder = -1,
  } = options;

  const filter = buildFilter({
    SECUCODE: seccode,
    REPORT_DATE: resolveReportDates({ reportDates, years }),
  });

  return fetchDataCenter('RPT_F10_FINANCE_GINCOME', 'APP_F10_GINCOME', {
    filter,
    p: page,
    ps: pageSize,
    sr: sortOrder,
    st: sortBy,
  });
}

/** 默认导出：便于 `import api from './incomeStatement'` 整体调用 */
const incomeStatementApi = { getStockIncomeStatement };

export default incomeStatementApi;
