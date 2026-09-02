#!/usr/bin/env node
/**
 * 沪深 A 股筛选器（命令行）
 *
 * 筛选条件：
 *   1. 总市值范围（亿元）
 *   2. 最近一年年报营业收入同比增速范围（%，默认 2025 年报）
 *
 * 数据来源：
 *   - 年报营收/同比：东方财富业绩报表（api/stockScreener.js 批量拉取）
 *   - 总市值：腾讯行情（api/quote.js 批量拉取）
 *
 * 用法示例：
 *   node scripts/stockScreener.js --min-mv 50 --max-mv 500 --min-grow 10 --max-grow 50
 *   node scripts/stockScreener.js --min-mv 100 --min-grow 20 --sort mv --top 20
 *   node scripts/stockScreener.js --min-mv 30 --max-mv 300 --min-grow 15 --out result.csv
 *   node scripts/stockScreener.js --min-grow 30 --no-exclude-st        # 保留 ST
 *   node scripts/stockScreener.js --min-mv 100 --no-cache              # 强制重新拉取数据
 *
 * 参数：
 *   --min-mv <num>   总市值下限（亿元，含）
 *   --max-mv <num>   总市值上限（亿元，含）
 *   --min-grow <num> 营收同比下限（%，含）
 *   --max-grow <num> 营收同比上限（%，含）
 *   --year <yyyy>    年报年份（默认 2025，即最近一个完整年报）
 *   --exclude-st / --no-exclude-st  排除 ST/*ST/退市股（默认排除）
 *   --sort <grow|mv> 排序字段（默认 grow，从高到低）
 *   --asc            升序（默认降序）
 *   --top <n>        控制台只显示前 n 条（默认 100；CSV 始终导出全部）
 *   --out <path>     导出全部结果为 CSV（UTF-8 BOM，Excel 可直接打开）
 *   --cache <path>   数据缓存文件（默认 .cache/stockScreener-<year>.json）
 *   --no-cache       忽略已有缓存，强制重新拉取
 *   --help           显示帮助
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fetchAnnualRevenueRows, fetchMarketCapMap, isHsACode } from '../api/stockScreener.js';

const DEFAULT_YEAR = 2025;

/* ───────────────────────── 参数解析 ───────────────────────── */

function parseArgs(argv) {
  const args = {
    minMv: null, maxMv: null, minGrow: null, maxGrow: null,
    year: DEFAULT_YEAR, excludeST: true, sort: 'grow', asc: false,
    top: 100, out: null, cache: null, noCache: false, help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`参数 ${a} 缺少值`);
      i += 1;
      return v;
    };
    switch (a) {
      case '--min-mv': args.minMv = Number(next()); break;
      case '--max-mv': args.maxMv = Number(next()); break;
      case '--min-grow': args.minGrow = Number(next()); break;
      case '--max-grow': args.maxGrow = Number(next()); break;
      case '--year': args.year = Number(next()); break;
      case '--exclude-st': args.excludeST = true; break;
      case '--no-exclude-st': args.excludeST = false; break;
      case '--sort': {
        const v = next();
        if (!['grow', 'mv'].includes(v)) throw new Error(`--sort 仅支持 grow|mv，收到: ${v}`);
        args.sort = v;
        break;
      }
      case '--asc': args.asc = true; break;
      case '--top': args.top = Number(next()); break;
      case '--out': args.out = next(); break;
      case '--cache': args.cache = next(); break;
      case '--no-cache': args.noCache = true; break;
      case '--help': case '-h': args.help = true; break;
      default: throw new Error(`未知参数: ${a}（用 --help 查看用法）`);
    }
  }
  // 校验
  for (const [k, v] of [['--min-mv', args.minMv], ['--max-mv', args.maxMv], ['--min-grow', args.minGrow], ['--max-grow', args.maxGrow]]) {
    if (v != null && (!Number.isFinite(v) || v < 0)) throw new Error(`${k} 必须是 ≥0 的数字，收到: ${v}`);
  }
  if (args.minMv != null && args.maxMv != null && args.minMv > args.maxMv) throw new Error('--min-mv 不能大于 --max-mv');
  if (args.minGrow != null && args.maxGrow != null && args.minGrow > args.maxGrow) throw new Error('--min-grow 不能大于 --max-grow');
  return args;
}

/* ───────────────────────── 筛选逻辑（纯计算） ───────────────────────── */

/** ST/*ST/退市 判断（按证券简称） */
function isSTName(name) {
  return name.includes('ST') || name.startsWith('退');
}

/**
 * 应用筛选条件
 * @param {Array} rows  [{ code, name, market, totalOperateIncome, yoy }]
 * @param {Map} mvMap   code -> { totalMv, floatMv }
 * @returns {Array}  [{ code, name, market, mv, revenueYi, yoy }]
 */
function applyScreen(rows, mvMap, { minMv, maxMv, minGrow, maxGrow, excludeST }) {
  const matched = [];
  for (const r of rows) {
    if (excludeST && isSTName(r.name)) continue;
    const mv = mvMap.get(r.code)?.totalMv ?? null;
    if (minMv != null && (mv == null || mv < minMv)) continue;
    if (maxMv != null && (mv == null || mv > maxMv)) continue;
    if (minGrow != null && (r.yoy == null || r.yoy < minGrow)) continue;
    if (maxGrow != null && (r.yoy == null || r.yoy > maxGrow)) continue;
    matched.push({
      code: r.code,
      name: r.name,
      market: r.market,
      mv,
      revenueYi: r.totalOperateIncome != null ? r.totalOperateIncome / 1e8 : null,
      yoy: r.yoy,
    });
  }
  return matched;
}

/* ───────────────────────── 数据获取 + 缓存 ───────────────────────── */

async function loadData({ year, cache, noCache }) {
  const reportDate = `${year}-12-31`;
  const cachePath = cache ?? `.cache/stockScreener-${year}.json`;

  if (!noCache && existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
    console.log(`📦 使用缓存数据（${cached.fetchedAt}）: ${cachePath}（加 --no-cache 强制刷新）`);
    return { rows: cached.rows, mvMap: new Map(Object.entries(cached.mvMap)) };
  }

  console.log(`⬇ 拉取 ${year} 年报营收数据（报告期 ${reportDate}）...`);
  const rows = await fetchAnnualRevenueRows(reportDate);
  console.log(`⬇ 批量获取 ${rows.length} 只股票的市值（腾讯行情）...`);
  const mvMap = await fetchMarketCapMap(rows.map((r) => r.code));

  if (!noCache) {
    const payload = {
      year,
      fetchedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      rows,
      mvMap: Object.fromEntries(mvMap),
    };
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(payload));
    console.log(`💾 已缓存原始数据: ${cachePath}`);
  }
  return { rows, mvMap };
}

/* ───────────────────────── 输出 ───────────────────────── */

/** CJK 视为 2 列宽的可见宽度 */
function visibleWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += ch.codePointAt(0) > 0x2e7f ? 2 : 1;
  return w;
}

function pad(s, width, align = 'right') {
  s = String(s ?? '');
  const gap = width - visibleWidth(s);
  if (gap <= 0) return s;
  return align === 'left' ? s + ' '.repeat(gap) : ' '.repeat(gap) + s;
}

function fmtNum(v, digits = 2) {
  if (v == null) return '—';
  return v.toFixed(digits);
}

function renderTable(rows, top) {
  const headers = ['代码', '名称', '市场', '总市值(亿)', '营收(亿)', '同比(%)'];
  const shown = rows.slice(0, top);
  const widths = headers.map((h, i) =>
    Math.max(visibleWidth(h), ...shown.map((r) => visibleWidth([r.code, r.name, r.market, fmtNum(r.mv), fmtNum(r.revenueYi), fmtNum(r.yoy)][i])))
  );
  const line = headers.map((h, i) => pad(h, widths[i], i <= 1 ? 'left' : 'right')).join('  ');
  console.log(line);
  console.log('-'.repeat(visibleWidth(line)));
  for (const r of shown) {
    console.log(
      [
        pad(r.code, widths[0]),
        pad(r.name, widths[1], 'left'),
        pad(r.market, widths[2], 'left'),
        pad(fmtNum(r.mv), widths[3]),
        pad(fmtNum(r.revenueYi), widths[4]),
        pad(fmtNum(r.yoy), widths[5]),
      ].join('  ')
    );
  }
  if (rows.length > top) console.log(`… 共 ${rows.length} 条，控制台仅显示前 ${top} 条（加 --out 导出全部 / --top 调整条数）`);
}

function writeCsv(path, rows) {
  const header = '代码,名称,市场,总市值(亿元),营业收入(亿元),营收同比(%)';
  const body = rows
    .map((r) => [r.code, r.name, r.market, fmtNum(r.mv), fmtNum(r.revenueYi), fmtNum(r.yoy)].join(','))
    .join('\n');
  writeFileSync(path, `\uFEFF${header}\n${body}\n`);
  console.log(`💾 已导出 ${rows.length} 条: ${path}`);
}

/* ───────────────────────── 主流程 ───────────────────────── */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`
沪深 A 股筛选器：市值范围 + 最近一年年报营收同比范围

用法：
  node scripts/stockScreener.js [参数]

筛选参数：
  --min-mv <num>   总市值下限（亿元，含）
  --max-mv <num>   总市值上限（亿元，含）
  --min-grow <num> 营收同比下限（%，含）
  --max-grow <num> 营收同比上限（%，含）
  --year <yyyy>    年报年份（默认 ${DEFAULT_YEAR}）
  --exclude-st / --no-exclude-st  排除 ST/*ST/退市股（默认排除）

输出参数：
  --sort <grow|mv> 排序字段（默认 grow 降序）
  --asc            升序
  --top <n>        控制台显示条数（默认 100）
  --out <path>     导出全部结果为 CSV（Excel 可直接打开）

数据参数：
  --cache <path>   数据缓存文件（默认 .cache/stockScreener-<year>.json）
  --no-cache       强制重新拉取数据

示例：
  node scripts/stockScreener.js --min-mv 50 --max-mv 500 --min-grow 10 --max-grow 50
  node scripts/stockScreener.js --min-mv 100 --min-grow 20 --sort mv --top 20 --out result.csv
`);
    return;
  }

  if (args.minMv == null && args.maxMv == null && args.minGrow == null && args.maxGrow == null) {
    throw new Error('请至少指定一个筛选条件，如 --min-mv 50 --min-grow 10（--help 查看用法）');
  }

  const { rows, mvMap } = await loadData(args);

  // 股票池统计（排除 ST 前 / 后）
  const stCount = args.excludeST ? rows.filter((r) => isSTName(r.name)).length : 0;
  const poolSize = args.excludeST ? rows.length - stCount : rows.length;

  const matched = applyScreen(rows, mvMap, args);

  // 排序
  const dir = args.asc ? 1 : -1;
  matched.sort((a, b) => {
    const va = args.sort === 'mv' ? a.mv : a.yoy;
    const vb = args.sort === 'mv' ? b.mv : b.yoy;
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // 缺数据排最后
    if (vb == null) return -1;
    return (va - vb) * dir;
  });

  // 摘要
  console.log('');
  console.log(`📊 数据: ${args.year} 年报（报告期 ${args.year}-12-31）｜沪深A股股票池 ${poolSize} 只${args.excludeST ? `（已剔除 ST/退市 ${stCount} 只）` : ''}`);
  console.log(
    `🔍 条件: 总市值 ${args.minMv ?? '—'} ~ ${args.maxMv ?? '—'} 亿元 ｜ 营收同比 ${args.minGrow ?? '—'} ~ ${args.maxGrow ?? '—'} %`
  );
  console.log(`✅ 命中: ${matched.length} 只\n`);

  if (matched.length > 0) {
    renderTable(matched, args.top);
    console.log('');
  }
  if (args.out) writeCsv(args.out, matched);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
