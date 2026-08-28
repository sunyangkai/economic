/**
 * 单只股票「机构盈利预测」接口（东方财富 F10）
 *
 * 端点: GET https://datacenter.eastmoney.com/securities/api/data/v1/get
 * 报表: reportName=RPT_HSF10_RES_ORGPREDICT
 *
 * 用的是 v1 接口：请求参数为 reportName/columns/pageNumber/pageSize/sortTypes/sortColumns，
 * 响应结构与财务报表类接口相同（result 含 pages/count/data）。
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
 *     "count": 19,              // 记录总数（机构/口径条数）
 *     "data": [                 // 机构盈利预测记录数组
 *       { "SECUCODE": "300760.SZ", "ORG_NAME_ABBR": "近六月平均", "EPS2": 7.13948, ... }
 *     ]
 *   }
 * }
 *
 * ── data[] 记录字段说明（实测）─────────────────────────────────────
 * 【基础信息】
 *   SECUCODE            证券代码(含市场后缀)，如 "300760.SZ"
 *   SECURITY_CODE       证券代码，如 "300760"
 *   SECURITY_NAME_ABBR  证券简称，如 "迈瑞医疗"
 *   PUBLISH_DATE        预测发布日期，如 "2026-08-03 00:00:00"
 *   ORG_CODE            机构代码，如 "00000000"（平均口径）
 *   ORG_NAME_ABBR       机构简称，如 "近六月平均"（近 6 个月所有机构预测均值）
 *
 * 【逐年预测】字段名按序号 YEAR1~YEAR4 分组，每组含年份/标记/EPS/PE：
 *   YEARn               年份，如 2025
 *   YEAR_MARKn          标记：A=实际值(Actual)，E=预测值(Eestimate)
 *   EPSn                预测每股收益 EPS(元)
 *   PEn                 对应市盈率 PE(倍)
 *
 * 注意：YEAR_MARK 标记为 A 的年份是已实现的实际值，E 才是机构预测。
 */

import { fetchReportData, buildFilter } from './request.js';

/** 机构盈利预测默认返回字段 */
export const ORG_PREDICT_COLUMNS = [
  'SECUCODE', 'SECURITY_CODE', 'SECURITY_NAME_ABBR',
  'PUBLISH_DATE', 'ORG_CODE', 'ORG_NAME_ABBR',
  'YEAR1', 'YEAR_MARK1', 'EPS1', 'PE1',
  'YEAR2', 'YEAR_MARK2', 'EPS2', 'PE2',
  'YEAR3', 'YEAR_MARK3', 'EPS3', 'PE3',
  'YEAR4', 'YEAR_MARK4', 'EPS4', 'PE4',
];

/**
 * 查询单只股票的机构盈利预测
 * @param {string} seccode 证券代码，如 "300760.SZ"
 * @param {object} [options]
 * @param {string|string[]} [options.columns=ORG_PREDICT_COLUMNS] 返回字段，可收窄或增补
 * @param {number} [options.pageNumber=1]
 * @param {number} [options.pageSize=200]
 * @param {string} [options.sortTypes]  排序类型，如 DESC
 * @param {string} [options.sortColumns] 排序列，如 PUBLISH_DATE
 * @returns {Promise<object>} { pages, count, data }，data 为机构盈利预测记录数组
 */
export function getOrgForecast(seccode, options = {}) {
  const {
    columns = ORG_PREDICT_COLUMNS,
    pageNumber = 1,
    pageSize = 200,
    sortTypes,
    sortColumns,
  } = options;

  return fetchReportData('RPT_HSF10_RES_ORGPREDICT', columns, {
    filter: buildFilter({ SECUCODE: seccode }),
    pageNumber,
    pageSize,
    ...(sortTypes !== undefined ? { sortTypes } : {}),
    ...(sortColumns !== undefined ? { sortColumns } : {}),
  });
}

/** 默认导出：便于 `import api from './orgForecast'` 整体调用 */
const orgForecastApi = { getOrgForecast, ORG_PREDICT_COLUMNS };

export default orgForecastApi;
