// 汇总打印关键指标（临时脚本）
import { readFileSync } from 'node:fs';
const load = (n) => JSON.parse(readFileSync(`temp/fenjiu/${n}.json`, 'utf8'));
const yi = (v) => (v == null ? '—' : (v / 1e8).toFixed(2));
const pct = (v) => (v == null ? '—' : v.toFixed(2));

console.log('=== 主要指标·年报（近5年） ===');
for (const r of load('main_annual')) {
  console.log([
    r.REPORT_DATE_NAME,
    '营收', yi(r.TOTALOPERATEREVE),
    '营收yoy', pct(r.TOTALOPERATEREVETZ) + '%',
    '归母', yi(r.PARENTNETPROFIT),
    '归母yoy', pct(r.PARENTNETPROFITTZ) + '%',
    '扣非', yi(r.KCFJCXSYJLR),
    '扣非yoy', pct(r.KCFJCXSYJLRTZ) + '%',
    '毛利率', pct(r.XSMLL) + '%',
    '净利率', pct(r.XSJLL) + '%',
    'ROE加权', pct(r.ROEJQ) + '%',
    '实际税率', pct(r.TAXRATE) + '%',
    'EPS', r.EPSJB,
    'BPS', r.BPS,
    '每股经营现金流', r.MGJYXJJE,
    '存货周转天数', r.CHZZTS,
    '应收周转天数', r.YSZKZZTS,
    '资产负债率', pct(r.ZCFZL) + '%',
    '员工', r.STAFF_NUM,
    '公告日', String(r.NOTICE_DATE || '').slice(0, 10),
  ].join(' | '));
}

console.log('\n=== 主要指标·中报（近2期） ===');
for (const r of load('main_hy').slice(0, 2)) {
  console.log([
    r.REPORT_DATE_NAME,
    '营收', yi(r.TOTALOPERATEREVE),
    '营收yoy', pct(r.TOTALOPERATEREVETZ) + '%',
    '归母', yi(r.PARENTNETPROFIT),
    '归母yoy', pct(r.PARENTNETPROFITTZ) + '%',
    '毛利率', pct(r.XSMLL) + '%',
    '公告日', String(r.NOTICE_DATE || '').slice(0, 10),
  ].join(' | '));
}

console.log('\n=== 利润表·年报（2021-2025） ===');
const incomeKeys = {
  TOTAL_OPERATE_INCOME: '营业总收入', OPERATE_COST: '营业成本', OPERATE_TAX_ADD: '税金及附加',
  SALE_EXPENSE: '销售费用', MANAGE_EXPENSE: '管理费用', RESEARCH_EXPENSE: '研发费用',
  FINANCE_EXPENSE: '财务费用', OPERATE_PROFIT: '营业利润', TOTAL_PROFIT: '利润总额',
  INCOME_TAX: '所得税', PARENT_NETPROFIT: '归母净利润', DEDUCT_PARENT_NETPROFIT: '扣非归母',
};
for (const r of load('income_annual')) {
  console.log(`\n-- ${String(r.REPORT_DATE).slice(0, 10)}`);
  for (const [k, label] of Object.entries(incomeKeys)) {
    if (r[k] != null) console.log(`${label}: ${yi(r[k])} 亿`);
  }
}

console.log('\n=== 资产负债表·年报（2025/2024 关键科目） ===');
const balKeys = {
  MONETARYFUNDS: '货币资金', TRADE_FINASSET_NOTFVTPL: '交易性金融资产', NOTE_ACCOUNTS_RECE: '应收票据及应收账款',
  INVENTORY: '存货', FIXED_ASSET: '固定资产', CIP: '在建工程', TOTAL_ASSETS: '总资产',
  SHORT_LOAN: '短期借款', LONG_LOAN: '长期借款', CONTRACT_LIAB: '合同负债', TOTAL_LIABILITIES: '总负债',
  TOTAL_PARENT_EQUITY: '归母净资产', ADVANCE_RECEIVABLES: '预收款', OTHER_CURRENT_ASSET: '其他流动资产',
};
for (const r of load('balance_annual').slice(0, 2)) {
  console.log(`\n-- ${String(r.REPORT_DATE).slice(0, 10)}`);
  for (const [k, label] of Object.entries(balKeys)) {
    if (r[k] != null) console.log(`${label}: ${yi(r[k])} 亿`);
  }
}

console.log('\n=== 现金流量表·年报（2021-2025） ===');
const cfKeys = {
  NETCASH_OPERATE: '经营现金流净额', NETCASH_INVEST: '投资现金流净额', NETCASH_FINANCE: '筹资现金流净额',
  CCE_ADD: '现金净增加额', ASSIGN_DIVIDEND_PORFIT: '分配股利利润偿付利息', BUILD_LONG_ASSET: '购建固定资产等',
  END_CCE: '期末现金',
};
for (const r of load('cashflow_annual')) {
  console.log(`\n-- ${String(r.REPORT_DATE).slice(0, 10)}`);
  for (const [k, label] of Object.entries(cfKeys)) {
    if (r[k] != null) console.log(`${label}: ${yi(r[k])} 亿`);
  }
}

console.log('\n=== 一致预期 ===');
for (const r of load('org_forecast').slice(0, 8)) {
  console.log([
    r.ORG_NAME_ABBR, '发布', String(r.PUBLISH_DATE || '').slice(0, 10),
    `Y1(${r.YEAR1}${r.YEAR_MARK1}) EPS ${r.EPS1} PE ${r.PE1}`,
    `Y2(${r.YEAR2}${r.YEAR_MARK2}) EPS ${r.EPS2} PE ${r.PE2}`,
    `Y3(${r.YEAR3}${r.YEAR_MARK3}) EPS ${r.EPS3} PE ${r.PE3}`,
    `Y4(${r.YEAR4}${r.YEAR_MARK4}) EPS ${r.EPS4} PE ${r.PE4}`,
  ].join(' | '));
}

console.log('\n=== 行情 ===');
const q = load('quote');
console.log(JSON.stringify({ price: q.price, prevClose: q.prevClose, peTtm: q.peTtm, pb: q.pb, totalMv: q.totalMv, timestamp: q.timestamp }));
