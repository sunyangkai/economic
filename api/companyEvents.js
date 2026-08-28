/**
 * 单只股票「公司大事」接口（东方财富 F10）
 *
 * 端点: GET https://datacenter.eastmoney.com/securities/api/data/get
 * 类型: type=RTP_F10_ADVANCE_DETAIL_NEW
 *
 * 与财务报表类接口不同：
 * - 用 params 传 "<证券代码>;<事件类型码列表>"，而非 filter/sty
 * - 分页用 p 翻页，配合返回的 hasNext 判断是否还有下一页
 * - 响应顶层为 { code, data, success, hasNext, message }，没有 result
 *
 * ── 响应数据结构（实测）────────────────────────────────────────────
 * {
 *   "code": 0,
 *   "success": true,
 *   "hasNext": true,          // 是否还有下一页（配合 page 翻页）
 *   "message": "请求成功",
 *   "data": [                 // 数组的数组：按事件大类(EVENT_TYPE)分组
 *     [                       // 一个分组 = 一类事件
 *       {
 *         "EVENT_TYPE": "报表披露",
 *         "SPECIFIC_EVENTTYPE": "中报预披露",
 *         "NOTICE_DATE": "2026-08-29",
 *         "LEVEL1_CONTENT": "于2026-08-29披露2026年中报",
 *         "LEVEL2_CONTENT": null,
 *         "INFO_CODE": null,
 *         "IOS_URL": "eastmoney://...",
 *         "ANDROID_URL": "dfcft://..."
 *       },
 *       { ... }
 *     ],
 *     [ ... 另一类事件 ... ]
 *   ]
 * }
 *
 * ── data[] 记录字段说明 ──
 *   EVENT_TYPE         事件大类，如 报表披露 / 分红送转 / 融资融券 / 股东增减持 ...
 *   SPECIFIC_EVENTTYPE 事件小类，如 年报披露 / 中报预披露
 *   NOTICE_DATE        公告/事件日期，如 "2026-08-29"
 *   LEVEL1_CONTENT     事件摘要文本
 *   LEVEL2_CONTENT     事件详情文本（可为 null）
 *   INFO_CODE          事件信息码（可为 null）
 *   IOS_URL            移动端(iOS)深链，如 eastmoney://page/emrn?id=...
 *   ANDROID_URL        移动端(Android)深链，如 dfcft://emrn?id=...
 *
 * 实测事件大类（共约 19 类）：报表披露、分红送转、融资融券、股东增减持、
 * 高管及关联方增减持、股权质押、解除质押、大宗交易、股东大会、机构调研、
 * 投资互动、项目投资、资本运作、新增概念、股东户数、沪深港通 等。
 */

import { fetchDetailData } from './request.js';

/** 东财 F10 事件类型码全集（默认取全部类型；用字符串保留三位前导零格式） */
export const ALL_EVENT_TYPES = [
  '100', '110', '120', '130', '140', '150', '160', '170', '180', '190',
  '200', '210', '220', '230', '240', '250', '260', '270', '280', '290',
  '300', '310', '320', '330', '340', '350', '360', '370', '380', '390',
  '400', '410', '420', '430', '440', '450', '460',
  '005', '001', '002', '003', '004', '006', '070', '080', '090',
];

/**
 * 查询单只股票的公司大事
 * @param {string} seccode 证券代码，如 "300760.SZ"
 * @param {object} [options]
 * @param {Array<number|string>} [options.eventTypes=ALL_EVENT_TYPES] 事件类型码数组（数字或字符串均可），用于收窄查询范围
 * @param {number}   [options.page=1]                                 页码，配合返回的 hasNext 翻页
 * @returns {Promise<object>} { data, hasNext }，data 为按事件类型分组的数组的数组
 */
export function getCompanyEvents(seccode, options = {}) {
  const { eventTypes = ALL_EVENT_TYPES, page = 1 } = options;

  const params = `${seccode};${eventTypes.map(String).join(',')}`;

  return fetchDetailData('RTP_F10_ADVANCE_DETAIL_NEW', params, { page });
}

/** 默认导出：便于 `import api from './companyEvents'` 整体调用 */
const companyEventsApi = { getCompanyEvents, ALL_EVENT_TYPES };

export default companyEventsApi;
