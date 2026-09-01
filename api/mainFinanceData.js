/**
 * 单只股票「主要财务指标」接口（东方财富 F10）
 *
 * 端点: GET https://datacenter.eastmoney.com/securities/api/data/get
 * 类型: type=RPT_F10_FINANCE_MAINFINADATA & sty=APP_F10_MAINFINADATA
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
 *     "pages": 4,               // 总页数
 *     "count": 12,              // 记录总数（报告期条数）
 *     "data": [                 // 财务指标记录数组，按 st/sr 排序
 *       { "SECUCODE": "300760.SZ", "REPORT_DATE": "2025-12-31 00:00:00", "EPSJB": 6.7147, ... }
 *     ]
 *   }
 * }
 *
 * ── data[] 记录字段说明（实测非银企业；银行/保险专用字段为 null）─────
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
 *   REPORT_YEAR         报告年份，如 "2025"
 *   IS_BZ               是否标准报告期："0" / "1"
 *
 * 【每股指标】(元)
 *   EPSJB               基本每股收益
 *   EPSKCJB             扣非每股收益
 *   EPSXS               稀释每股收益
 *   BPS                 每股净资产
 *   MGZBGJ              每股资本公积
 *   MGWFPLR             每股未分配利润
 *   MGJYXJJE            每股经营现金流
 *
 * 【盈利能力】(比率字段为 %)
 *   TOTALOPERATEREVE    营业总收入(元)
 *   MLR                 毛利润(元)
 *   PARENTNETPROFIT     归母净利润(元)
 *   KCFJCXSYJLR         扣非净利润(元)
 *   ROEJQ               加权净资产收益率 ROE(%)
 *   ROEKCJQ             扣非加权 ROE(%)
 *   ZZCJLL              总资产净利率(%)
 *   XSJLL               销售净利率(%)
 *   XSMLL               销售毛利率(%)
 *   ROIC                投入资本回报率(%)
 *   TAXRATE             实际所得税率(%)
 *
 * 【成长能力】(单位 %)
 *   TOTALOPERATEREVETZ  营业总收入同比增长
 *   PARENTNETPROFITTZ   归母净利润同比增长
 *   KCFJCXSYJLRTZ       扣非净利润同比增长
 *   YYZSRGDHBZC         营业总收入环比增长
 *   NETPROFITRPHBZC     净利润环比增长
 *   KFJLRGDHBZC         扣非净利润环比增长
 *   EPSJBTZ / BPSTZ     基本EPS / 每股净资产同比增长
 *   ROEJQTZ / ROICTZ    加权ROE / ROIC 同比变动
 *   DJD_TOI_YOY         单季度营收同比
 *   DJD_DPNP_YOY        单季度归母净利同比
 *   DJD_DEDUCTDPNP_YOY  单季度扣非净利同比
 *   DJD_TOI_QOQ         单季度营收环比
 *   DJD_DPNP_QOQ        单季度归母净利环比
 *   DJD_DEDUCTDPNP_QOQ  单季度扣非净利环比
 *
 * 【营运能力】
 *   TOAZZL              总资产周转率(次)
 *   CHZZL               存货周转率(次)
 *   YSZKZZL             应收账款周转率(次)
 *   ZZCZZTS             总资产周转天数(天)
 *   CHZZTS              存货周转天数(天)
 *   YSZKZZTS            应收账款周转天数(天)
 *   OPERATE_CYCLE       营业周期(天)
 *
 * 【偿债能力】
 *   LD                  流动比率
 *   SD                  速动比率
 *   XJLLB               现金流量比率
 *   ZCFZL               资产负债率(%)
 *   QYCS                权益乘数
 *   CQBL                产权比率
 *   CASH_RATIO          现金比率
 *   INTEREST_COVERAGE_RATIO 利息保障倍数
 *
 * 【现金流量】(元)
 *   XSJXLYYSR           销售收现比(销售商品收到现金/营业收入)
 *   JYXJLYYSR           经营现金流净额/营业收入
 *   FCFF_FORWARD        企业自由现金流 FCFF(元)
 *   FCFF_BACK           股权自由现金流 FCFE(元)
 *
 * 【其他】
 *   STAFF_NUM           员工人数
 *   AVG_TOI             人均创收(元/人)
 *   AVG_NET_PROFIT      人均净利润(元/人)
 *   LIABILITY           负债合计(元)
 *
 * 注: TOTALDEPOSITS / GROSSLOANS / JZB / NBV_LIFE 等为银行、保险行业专用字段，
 *     通用(非金融)企业返回 null，可忽略。
 */

import { fetchDataCenter, buildSecFilter } from './request.js';

/**
 * 查询单只股票的主要财务指标（F10 财务指标）
 * @param {string} seccode 证券代码，如 "300760.SZ"
 * @param {object} [options]
 * @param {string}   [options.reportType='年报'] 报告期类型：年报 / 中报 / 一季报 / 三季报
 * @param {number}   [options.page=1]
 * @param {number}   [options.pageSize=200]
 * @param {string}   [options.sortBy='REPORT_DATE']
 * @param {number}   [options.sortOrder=-1]
 * @returns {Promise<object>} { pages, count, data }，data 为财务指标记录数组
 */
export function getStockMainFinanceData(seccode, options = {}) {
  const {
    reportType = '年报',
    page = 1,
    pageSize = 200,
    sortBy = 'REPORT_DATE',
    sortOrder = -1,
  } = options;

  const filter = buildSecFilter(seccode, { REPORT_TYPE: reportType });

  return fetchDataCenter('RPT_F10_FINANCE_MAINFINADATA', 'APP_F10_MAINFINADATA', {
    filter,
    p: page,
    ps: pageSize,
    sr: sortOrder,
    st: sortBy,
  });
}

/** 默认导出：便于 `import api from './mainFinanceData'` 整体调用 */
const mainFinanceApi = { getStockMainFinanceData };

export default mainFinanceApi;
