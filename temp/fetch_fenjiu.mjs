// 山西汾酒 600809.SH 硬数据一次性抓取（临时脚本，用完即删）
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  getStockMainFinanceData,
  getStockBalanceSheet,
  getStockIncomeStatement,
  getStockCashFlowStatement,
  getCompanyEvents,
  getOrgForecast,
  getQuote,
  getHolderNumberTrend,
  getTopFreeHolders,
  getTopHolders,
} from '../api/index.js';

const SEC = '600809.SH';
const OUT = 'temp/fenjiu';
mkdirSync(OUT, { recursive: true });

const save = (name, data) => {
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, null, 1));
  console.log(`✓ ${name}`);
};

const years = [2025, 2024, 2023, 2022, 2021];

// 1. 现价
const quote = await getQuote('600809');
save('quote', quote);

// 2. 主要指标（年报）
const main = await getStockMainFinanceData(SEC, { reportType: '年报' });
save('main_annual', main.data);

// 2b. 主要指标（中报，仅时间轴/口径用）
const mainHy = await getStockMainFinanceData(SEC, { reportType: '中报' });
save('main_hy', mainHy.data);

// 3-5. 三表（年报，近 5 年）
for (const [name, fn] of [
  ['income_annual', getStockIncomeStatement],
  ['balance_annual', getStockBalanceSheet],
  ['cashflow_annual', getStockCashFlowStatement],
]) {
  const r = await fn(SEC, { years });
  save(name, r.data);
}

// 6. 一致预期
const forecast = await getOrgForecast(SEC);
save('org_forecast', forecast.data);

// 7. 股东
save('holder_num', await getHolderNumberTrend(SEC));
save('top_free_holders', await getTopFreeHolders(SEC));
save('top_holders', await getTopHolders(SEC));

// 8. 公司大事
const events = await getCompanyEvents(SEC);
save('company_events', events.data);

console.log('全部抓取完成');
