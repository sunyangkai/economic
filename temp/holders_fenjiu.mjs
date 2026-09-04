// 股东与大事汇总（临时脚本）
import { readFileSync } from 'node:fs';
const load = (n) => JSON.parse(readFileSync(`temp/fenjiu/${n}.json`, 'utf8'));

console.log('=== 股东户数（近8期） ===');
for (const r of load('holder_num').slice(0, 8)) {
  console.log([String(r.END_DATE).slice(0, 10), '户数', r.HOLDER_NUM, '变动', r.HOLDER_NUM_CHANGE, '变动率', r.HOLDER_NUM_RATIO + '%', '户均市值(万)', r.AVG_MARKET_CAP ? (r.AVG_MARKET_CAP / 1e4).toFixed(1) : '—'].join(' | '));
}

console.log('\n=== 前十大股东（2026-06-30 期） ===');
const byDate = new Map();
for (const r of load('top_holders')) {
  const d = String(r.END_DATE).slice(0, 10);
  if (!byDate.has(d)) byDate.set(d, []);
  byDate.get(d).push(r);
}
const dates = [...byDate.keys()].sort().reverse().slice(0, 4);
console.log('可用报告期:', dates.join(', '));
for (const d of [dates[0], dates[dates.length - 1]]) {
  console.log(`\n-- ${d}`);
  for (const r of byDate.get(d)) {
    console.log([r.HOLDER_RANK, r.HOLDER_NAME, '比例', Number(r.HOLD_NUM_RATIO).toFixed(2) + '%', '持股(万)', (r.HOLD_NUM / 1e4).toFixed(1), '变动', r.HOLD_NUM_CHANGE, r.CHANGE_RATIO != null ? Number(r.CHANGE_RATIO).toFixed(1) + '%' : ''].join(' | '));
  }
}

console.log('\n=== 前十大流通股东（最近3期对比） ===');
const freeByDate = new Map();
for (const r of load('top_free_holders')) {
  const d = String(r.END_DATE).slice(0, 10);
  if (!freeByDate.has(d)) freeByDate.set(d, []);
  freeByDate.get(d).push(r);
}
const fdates = [...freeByDate.keys()].sort().reverse().slice(0, 3);
console.log('可用报告期:', fdates.join(', '));
for (const d of fdates) {
  console.log(`\n-- ${d}`);
  for (const r of freeByDate.get(d)) {
    console.log([r.HOLDER_RANK, r.HOLDER_NAME, '比例', Number(r.HOLD_RATIO).toFixed(3) + '%', r.HOLD_CHANGE, r.HOLD_RATIO_CHANGE != null ? 'Δ' + Number(r.HOLD_RATIO_CHANGE).toFixed(3) + 'pp' : ''].join(' | '));
  }
}

console.log('\n=== 公司大事（分组计数） ===');
const events = load('company_events');
events.forEach((group, i) => {
  if (!Array.isArray(group) || group.length === 0) return;
  const type = group[0].EVENT_TYPE || group[0].eventTypeName || `组${i}`;
  console.log(`-- ${type}: ${group.length} 条`);
  for (const e of group.slice(0, 12)) {
    const keys = Object.keys(e);
    const date = e.EVENT_DATE || e.NOTICE_DATE || e.ANNOUNCE_DATE || e.DATE || '';
    const what = e.EVENT_CONTENT || e.CONTENT || e.TITLE || e.EVENT || '';
    console.log('   ', String(date).slice(0, 10), '|', String(what).slice(0, 110));
  }
});
