/**
 * 单只股票「现金流量表」接口（东方财富 F10）
 *
 * 端点: GET https://datacenter.eastmoney.com/securities/api/data/get
 * 类型: type=RPT_F10_FINANCE_GCASHFLOW & sty=APP_F10_GCASHFLOW
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
 *     "data": [                 // 现金流量表记录数组，按 st/sr 排序
 *       { "SECUCODE": "300760.SZ", "REPORT_DATE": "2025-12-31 00:00:00", "NETCASH_OPERATE": 10144968535, ... }
 *     ]
 *   }
 * }
 *
 * ── data[] 记录字段说明（实测非银企业；银行/保险/券商专用字段为 null）────
 * 每个科目字段都带对应的 *_YOY 字段（同比变动，%），如 NETCASH_OPERATE_YOY。
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
 * 【经营活动现金流量】(元)
 *   SALES_SERVICES          销售商品、提供劳务收到的现金
 *   RECEIVE_TAX_REFUND      收到的税费返还
 *   RECEIVE_OTHER_OPERATE   收到其他与经营活动有关的现金
 *   TOTAL_OPERATE_INFLOW    经营活动现金流入小计
 *   BUY_SERVICES            购买商品、接受劳务支付的现金
 *   PAY_STAFF_CASH          支付给职工以及为职工支付的现金
 *   PAY_ALL_TAX             支付的各项税费
 *   PAY_OTHER_OPERATE       支付其他与经营活动有关的现金
 *   TOTAL_OPERATE_OUTFLOW   经营活动现金流出小计
 *   NETCASH_OPERATE         经营活动产生的现金流量净额
 *
 * 【投资活动现金流量】(元)
 *   WITHDRAW_INVEST            收回投资收到的现金
 *   RECEIVE_INVEST_INCOME      取得投资收益收到的现金
 *   DISPOSAL_LONG_ASSET        处置固定资产、无形资产和其他长期资产收回的现金净额
 *   DISPOSAL_SUBSIDIARY_OTHER  处置子公司及其他营业单位收到的现金净额
 *   RECEIVE_OTHER_INVEST       收到其他与投资活动有关的现金
 *   TOTAL_INVEST_INFLOW        投资活动现金流入小计
 *   CONSTRUCT_LONG_ASSET       购建固定资产、无形资产和其他长期资产支付的现金
 *   INVEST_PAY_CASH            投资支付的现金
 *   OBTAIN_SUBSIDIARY_OTHER    取得子公司及其他营业单位支付的现金净额
 *   PAY_OTHER_INVEST           支付其他与投资活动有关的现金
 *   TOTAL_INVEST_OUTFLOW       投资活动现金流出小计
 *   NETCASH_INVEST             投资活动产生的现金流量净额
 *
 * 【筹资活动现金流量】(元)
 *   ACCEPT_INVEST_CASH         吸收投资收到的现金
 *     SUBSIDIARY_ACCEPT_INVEST   其中：子公司吸收少数股东投资收到的现金
 *   RECEIVE_LOAN_CASH          取得借款收到的现金
 *   ISSUE_BOND                 发行债券收到的现金
 *   RECEIVE_OTHER_FINANCE      收到其他与筹资活动有关的现金
 *   TOTAL_FINANCE_INFLOW       筹资活动现金流入小计
 *   PAY_DEBT_CASH              偿还债务支付的现金
 *   ASSIGN_DIVIDEND_PORFIT     分配股利、利润或偿付利息支付的现金
 *     SUBSIDIARY_PAY_DIVIDEND    其中：子公司支付给少数股东的股利、利润
 *   BUY_SUBSIDIARY_EQUITY      购买子公司少数股权支付的现金
 *   PAY_OTHER_FINANCE          支付其他与筹资活动有关的现金
 *   TOTAL_FINANCE_OUTFLOW      筹资活动现金流出小计
 *   NETCASH_FINANCE            筹资活动产生的现金流量净额
 *
 * 【汇率变动与现金净额】(元)
 *   RATE_CHANGE_EFFECT  汇率变动对现金及现金等价物的影响
 *   CCE_ADD             现金及现金等价物净增加额
 *   BEGIN_CCE           期初现金及现金等价物余额
 *   END_CCE             期末现金及现金等价物余额
 *
 * 【补充资料（间接法）】(元)
 *   NETPROFIT               净利润
 *   ASSET_IMPAIRMENT        资产减值准备
 *   FA_IR_DEPR              固定资产折旧、油气资产折耗、生产性生物资产折旧
 *   USERIGHT_ASSET_AMORTIZE 使用权资产摊销
 *   IA_AMORTIZE             无形资产摊销
 *   LPE_AMORTIZE            长期待摊费用摊销
 *   DEFER_INCOME_AMORTIZE   递延收益摊销
 *   DISPOSAL_LONGASSET_LOSS 处置固定资产、无形资产和其他长期资产的损失
 *   FAIRVALUE_CHANGE_LOSS   公允价值变动损失
 *   FINANCE_EXPENSE         财务费用
 *   INVEST_LOSS             投资损失
 *   DEFER_TAX               递延所得税
 *   INVENTORY_REDUCE        存货的减少
 *   OPERATE_RECE_REDUCE     经营性应收项目的减少
 *   OPERATE_PAYABLE_ADD     经营性应付项目的增加
 *   OTHER                   其他
 *   NETCASH_OPERATENOTE     间接法下经营活动产生的现金流量净额
 *
 * 注: 银行/保险/券商专用字段（DEPOSIT_INTERBANK_ADD、LOAN_ADVANCE_ADD、
 *     RECEIVE_ORIGIC_PREMIUM 等）通用(非金融)企业返回 null，可忽略。
 */

import { fetchDataCenter, buildFilter, resolveReportDates } from './request.js';

/**
 * 查询单只股票的现金流量表（支持多个报告期）
 * @param {string} seccode 证券代码，如 "300760.SZ"
 * @param {object} [options]
 * @param {string[]} [options.reportDates] 报告期日期数组，如 ['2025-12-31','2024-12-31']，
 *                                         通过 filter 的 REPORT_DATE in (...) 查询
 * @param {number[]}  [options.years]      年份数组，如 [2025, 2024]，自动转成各年 12-31 日期
 * @param {number}    [options.page=1]
 * @param {number}    [options.pageSize=200]
 * @param {string}    [options.sortBy='REPORT_DATE']
 * @param {number}    [options.sortOrder=-1]
 * @returns {Promise<object>} { pages, count, data }，data 为现金流量表记录数组
 *
 * 默认 reportDates 为最近 5 个已完成年度报告的 12-31 日期；
 * reportDates 与 years 同时给出时优先用 years。
 */
export function getStockCashFlowStatement(seccode, options = {}) {
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

  return fetchDataCenter('RPT_F10_FINANCE_GCASHFLOW', 'APP_F10_GCASHFLOW', {
    filter,
    p: page,
    ps: pageSize,
    sr: sortOrder,
    st: sortBy,
  });
}

/** 默认导出：便于 `import api from './cashFlowStatement'` 整体调用 */
const cashFlowStatementApi = { getStockCashFlowStatement };

export default cashFlowStatementApi;
