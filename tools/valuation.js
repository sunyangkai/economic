/**
 * 三段式利润估值（扩张期逐年扣 E，永续期用 θₓ）
 *
 * 模型定义见 doc/估值理论/估值模型.md；本文件同时提供：
 * ① calculateValuation() —— 纯函数，返回内在 PE 及拆分（扩张期现值 / 终值现值 / DP 序列）；
 * ② renderScenarioTables() —— spec JSON → 研报可直接粘贴的 markdown 情景表；
 * ③ CLI —— node tools/valuation.js <spec.json>。
 *
 * 估值口径：前 N 年按逐年可分配利润 DP_t = NP_t − (E_t − P_t) 折现，
 * 永续期按 DP_{N+1} = NP_{N+1} × θₓ 折现——θ 只作用于永续期。
 *
 * ── CLI 用法 ────────────────────────────────────────────────────────
 *   node tools/valuation.js --help                # 用法说明
 *   node tools/valuation.js <spec.json>           # 输出 markdown 情景表
 *   node tools/valuation.js                       # 内置示例
 *
 * spec.json 格式：
 * {
 *   "macro": { "rf": 0.0165, "nominalGdpGrowth": 4 },   // 可选，默认 rf 0.0165 / ERP 0.068
 *   "tables": [
 *     {
 *       "kind": "theta",                        // θₓ 情景表：固定增速与资本开支，变稳态 ROIC
 *       "title": "θₓ 情景表（固定三年增速 [12%, 12%, 12%]）",
 *       "growthForecasts": [0.12, 0.12, 0.12],
 *       "eps": 7.14,                            // 基准年 EPS，折算股价用
 *       "capex":  [1.1, 1.3, 1.5, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6],
 *       "da":     [0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15],
 *       "deltaWc":[0.1, 0.12, 0.13, 0.12, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05],
 *       "rows": [
 *         { "name": "重资产 15%", "roic": 0.15 },
 *         { "name": "基准 30%",   "roic": 0.30 }
 *       ]
 *     },
 *     {
 *       "kind": "growth",                       // 增速情景表：固定 ROIC 与资本开支、变增速
 *       "title": "增速情景表（ROIC 固定 30%）",
 *       "roic": 0.30,
 *       "capex":  [1.1, 1.3, 1.5, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6],
 *       "da":     [0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15],
 *       "deltaWc":[0.1, 0.12, 0.13, 0.12, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05],
 *       "availableFunds": 1.5,                  // F（可供发展资金）；缺省 0
 *       "currentPrice": 164.03,                 // 现价，用于"相对现价"列
 *       "rows": [
 *         { "name": "[0%, 5%, 6%]（悲观）", "growthForecasts": [0, 0.05, 0.06], "eps": 6.71 }
 *       ],
 *       "epsTtm": 1.9408                        // 可选：给出 TTM EPS 时额外输出"内在 TTM PE"列
 *     }
 *   ]
 * }
 *
 * 扩张期资本消耗 E_t 的三种给法（每张表/每行选一种）：
 *   ① expansionSpend: [E_t]        直接给逐年 E
 *   ② capex + da + deltaWc         三张逐年表，内部算 E_t = (Capex − DA) + ΔWC
 *   ③ roic                         兜底：E_t = ΔNP_t / ROIC（无 capex 规划时使用）
 * 数组长度必须等于总年数 N（= 3 + transitionYears）。
 *
 * 每张表还支持可选 "transitionYears"（默认 7）覆盖过渡期年数；研报基准一律用 7，不因个股调整。
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_MACRO = { rf: 0.0165, nominalGdpGrowth: 4, equityRiskPremium: 0.068 };

const isNum = (x) => Number.isFinite(x);

/** 生成利润路径 np[1..N]（np[0] 不返回，内部按 1 起算） */
function buildProfitPath({ growthForecasts, gInfinity, transitionYears, np0 = 1 }) {
  if (!Array.isArray(growthForecasts) || growthForecasts.length !== 3) {
    throw new Error('company.growthForecasts 必须是长度为 3 的数组，例如 [0.12, 0.10, 0.08]');
  }
  const [g1, g2, g3] = growthForecasts;
  for (const [name, g] of [['g1', g1], ['g2', g2], ['g3', g3]]) {
    if (!isNum(g) || g <= -1) throw new Error(`${name} 必须是大于 -1 的有限数字；当前版本不考虑亏损情形`);
  }

  const N = 3 + transitionYears;
  const np = [np0];
  np.push(np[0] * (1 + g1));
  np.push(np[1] * (1 + g2));
  np.push(np[2] * (1 + g3));

  for (let t = 4; t <= N; t++) {
    const step = (t - 3) / (transitionYears + 1);
    const gt = g3 + step * (gInfinity - g3);
    const next = np[t - 1] * (1 + gt);
    if (next <= 0) throw new Error('过渡期利润小于等于 0；当前版本不考虑亏损情形');
    np.push(next);
  }
  return np; // np[0..N]
}

/** 解析扩张期逐年 E（长度 N），三种给法任选其一 */
function buildExpansionSpend({ company, np, N }) {
  const { expansionSpend, capex, da, deltaWc, roic } = company || {};
  const checkLen = (arr, name) => {
    if (!Array.isArray(arr)) throw new Error(`${name} 必须是数组`);
    if (arr.length !== N) throw new Error(`${name} 长度必须等于总年数 ${N}（3 + 过渡期 ${N - 3}）`);
    arr.forEach((x, i) => {
      if (!isNum(x)) throw new Error(`${name}[${i}] 必须是有限数字`);
    });
  };

  if (Array.isArray(expansionSpend)) {
    checkLen(expansionSpend, 'company.expansionSpend');
    return expansionSpend.slice();
  }

  if (Array.isArray(capex)) {
    checkLen(capex, 'company.capex');
    checkLen(da, 'company.da');
    checkLen(deltaWc, 'company.deltaWc');
    return capex.map((c, i) => c - da[i] + deltaWc[i]); // MC ≡ DA
  }

  // 兜底：E_t = ΔNP_t / ROIC，等价于 g_t × IC_{t-1}（roic 已在主函数校验）
  return Array.from({ length: N }, (_, i) => (np[i + 1] - np[i]) / roic);
}

/**
 * 估值主函数：返回内在 PE 及拆分
 *
 * @param {Object} params
 * @param {Object} params.company
 * @param {number[]} params.company.growthForecasts - 三年利润增速 [g1, g2, g3]
 * @param {number} [params.company.transitionYears=7] - 过渡期年数；研报基准固定 7
 * @param {number[]} [params.company.expansionSpend] - 逐年扩张性消耗 E_t（长度 N）
 * @param {number[]} [params.company.capex] - 逐年 capex（与 da、deltaWc 同用）
 * @param {number[]} [params.company.da] - 逐年折旧摊销
 * @param {number[]} [params.company.deltaWc] - 逐年营运资本增量
 * @param {number} params.company.roic - 稳态 ROIC（必填）：解出 θₓ = 1 − g∞/ROIC；无 capex 规划时兜底算 E
 * @param {number} [params.company.np0=1] - 基年利润（与 capex/F 同单位）；缺省 1 表示按"单位利润"标准化
 * @param {number} [params.company.availableFunds=0] - 可供发展资金 F（C₀），与 np0 同单位
 * @param {Object} params.macro
 * @param {number} params.macro.rf
 * @param {number} params.macro.nominalGdpGrowth
 * @param {number} [params.macro.equityRiskPremium=0.068]
 *
 * @returns {Object} { pe, pvExpansion, pvTerminal, thetaX, R, gInfinity, npPath, ePath, dpPath, cashPath }
 */
export function calculateValuation({ company = {}, macro = {} } = {}) {
  const { growthForecasts, transitionYears = 7, availableFunds = 0, roic, np0 = 1 } = company;

  const {
    rf,
    nominalGdpGrowth,
    equityRiskPremium = 0.068,
  } = { ...DEFAULT_MACRO, ...macro };

  for (const [key, value] of Object.entries({ rf, nominalGdpGrowth, equityRiskPremium, transitionYears, availableFunds, np0 })) {
    if (!isNum(value)) throw new Error(`${key} 必须是有限数字`);
  }
  if (np0 <= 0) throw new Error('np0（基年利润）必须为正数');
  if (!Number.isInteger(transitionYears) || transitionYears < 0) {
    throw new Error('transitionYears 必须是大于等于 0 的整数');
  }
  if (availableFunds < 0) throw new Error('availableFunds（F）不能为负');

  const R = rf + equityRiskPremium;
  const gInfinity = (0.35 * nominalGdpGrowth / (1 + 0.35 * nominalGdpGrowth)) * 0.04;
  if (R <= gInfinity) throw new Error('折现率 R 必须大于终局增速 g∞');

  // 稳态 ROIC：必填，既是 θₓ 的唯一来源，也是无 capex 规划时 E 的兜底
  if (!isNum(roic) || roic <= 0) {
    throw new Error('company.roic 必填且须为正数：θₓ = 1 − g∞/ROIC');
  }
  if (roic <= gInfinity) {
    throw new Error(`ROIC（${roic}）必须大于 g∞（${gInfinity.toFixed(4)}），否则 θₓ ≤ 0`);
  }
  const theta = 1 - gInfinity / roic;

  const N = 3 + transitionYears;
  const np = buildProfitPath({ growthForecasts, gInfinity, transitionYears, np0 });
  const ePath = buildExpansionSpend({ company, np, N });

  // 扩张期：逐年可分配利润 DP_t = NP_t − (E_t − P_t)，P_t = min(E_t, C_t)
  const cashPath = [availableFunds];
  const dpPath = [];
  let pvExpansion = 0;

  for (let t = 1; t <= N; t++) {
    const cash = cashPath[t - 1];
    const e = ePath[t - 1];
    const p = Math.min(Math.max(e, 0), cash); // 现金只垫正数支出
    const dp = np[t] - (e - p);
    dpPath.push(dp);
    pvExpansion += dp / Math.pow(1 + R, t);
    cashPath.push(cash - p);
  }

  // 永续期：只此一处用 θ
  const npNext = np[N] * (1 + gInfinity);
  const dpNext = npNext * theta;
  const pvTerminal = dpNext / (R - gInfinity) / Math.pow(1 + R, N);

  return {
    pe: (pvExpansion + pvTerminal) / np0,
    pvExpansion,
    pvTerminal,
    thetaX: theta,
    R,
    gInfinity,
    npPath: np.slice(1), // 与 t=1..N 对齐
    ePath,
    dpPath,
    cashPath,
  };
}

/* ───────────────────────── 情景生成器（CLI） ───────────────────────── */

/** 表级默认值 + 行级覆盖，合并成一份 company 参数 */
function mergeCompany(table, row) {
  const picked = {};
  for (const key of [
    'growthForecasts',
    'transitionYears',
    'expansionSpend',
    'capex',
    'da',
    'deltaWc',
    'roic',
    'availableFunds',
  ]) {
    if (row[key] !== undefined) picked[key] = row[key];
    else if (table[key] !== undefined) picked[key] = table[key];
  }
  return picked;
}

/** 渲染 θₓ 情景表（固定增速与资本开支，变稳态 ROIC；θₓ 由 ROIC 解出） */
function renderThetaTable(table, macro) {
  const { title, eps, rows } = table;
  const header = `| 情景 | 稳态 ROIC | θₓ | 内在 PE | 对应股价（基准年 EPS ${eps}） |`;
  const sep = `| --- | ---: | ---: | ---: | ---: |`;
  const body = rows
    .map((r) => {
      const company = mergeCompany(table, r);
      const { pe, thetaX: tx } = calculateValuation({ company, macro });
      const roic = company.roic;
      return `| ${r.name} | ${(roic * 100).toFixed(1).replace(/\.0$/, '')}% | ${tx.toFixed(3)} | ${pe.toFixed(1)}x | ~${Math.round(pe * eps)} 元 |`;
    })
    .join('\n');
  return `**${title}**\n\n${header}\n${sep}\n${body}`;
}

/** 渲染增速情景表（固定 θₓ 与资本开支、变增速；行内可覆盖任意输入） */
function renderGrowthTable(table, macro) {
  const { title, currentPrice, rows, epsLabel = '2026E EPS', epsTtm } = table;
  const showTtm = Number.isFinite(epsTtm) && epsTtm > 0;
  const ttmHead = showTtm ? ' 内在 TTM PE |' : '';
  const ttmSep = showTtm ? ' ---: |' : '';
  const header = `| 三年增速（归母口径） | ${epsLabel} | 内在 PE |${ttmHead} 对应股价 | 相对现价 ${currentPrice} 元 |`;
  const sep = `| --- | ---: | ---: |${ttmSep} ---: | ---: |`;
  const fmtG = (x) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
  const body = rows
    .map((r) => {
      const company = mergeCompany(table, r);
      const { pe } = calculateValuation({ company, macro });
      const price = pe * r.eps;
      const rel = ((price / currentPrice - 1) * 100).toFixed(0);
      const relStr = Number(rel) === 0 ? '0%' : Number(rel) > 0 ? `+${rel}%` : `${rel}%`;
      const g = r.growthForecasts.map(fmtG).join(', ');
      const label = r.name.includes('[') ? r.name : `${r.name}（[${g}]）`;
      const ttmCell = showTtm ? ` ${(price / epsTtm).toFixed(1)}x |` : '';
      return `| ${label} | ${r.eps} | ${pe.toFixed(1)}x |${ttmCell} ~${Math.round(price)} 元 | ${relStr} |`;
    })
    .join('\n');
  return `**${title}**\n\n${header}\n${sep}\n${body}`;
}

/** 根据 spec 渲染全部情景表（返回 markdown 文本） */
export function renderScenarioTables(spec) {
  const macro = { ...DEFAULT_MACRO, ...(spec.macro || {}) };
  return (spec.tables || [])
    .map((t) => (t.kind === 'theta' ? renderThetaTable(t, macro) : renderGrowthTable(t, macro)))
    .join('\n\n---\n\n');
}

const USAGE = `用法:
  node tools/valuation.js --help        # 本说明
  node tools/valuation.js <spec.json>   # 输出 markdown 情景表（spec 格式见文件头注释）
  node tools/valuation.js               # 运行内置示例

模型：前 N 年（3 明确 + 7 过渡）按 DP_t = NP_t − (E_t − P_t) 折现，永续期按 DP_{N+1} = NP_{N+1} × θₓ 折现。
company.roic 必填（θₓ = 1 − g∞/ROIC，无 capex 规划时也是 E 的兜底）。
扩张期 E_t 优先用 capex+da+deltaWc，其次 expansionSpend，最后 roic 兜底。
tables 支持 kind="theta"（固定增速与 capex、变 ROIC）与 kind="growth"（固定 ROIC 与 capex、变增速）。`;

/** CLI 入口：直接执行本文件时运行（import 时不执行） */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const [arg] = process.argv.slice(2);
  if (arg === '--help' || arg === '-h') {
    console.log(USAGE);
  } else if (arg) {
    const spec = JSON.parse(readFileSync(arg, 'utf-8'));
    console.log(renderScenarioTables(spec));
  } else {
    // 内置示例：同一组利润路径，两种资本强度
    for (const roic of [0.30, 0.10]) {
      const v = calculateValuation({
        company: { growthForecasts: [0.12, 0.12, 0.12], roic, availableFunds: 0 },
        macro: DEFAULT_MACRO,
      });
      console.log(
        `ROIC ${(roic * 100).toFixed(0)}% → θₓ ${(v.thetaX * 100).toFixed(1)}%，PE ${v.pe.toFixed(1)}x`
      );
    }
  }
}
