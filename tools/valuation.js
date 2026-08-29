/**
 * 三段式利润估值 + 整体兑现折价（统一估值模型的可执行实现）
 *
 * 模型定义见 doc/估值理论/估值模型.md；本文件同时提供：
 * ① calculateIntrinsicPe() —— 纯函数，给定利润增速路径与兑现系数返回内在 PE；
 * ② 情景生成器 CLI —— 输入 spec JSON，直接输出研报可直接粘贴的 markdown 情景表，
 *    消灭手算/脚本重写导致的估值错误（如增速路径与 EPS 不匹配、θ 算错）。
 *
 * ── CLI 用法 ────────────────────────────────────────────────────────
 *   node tools/valuation.js --help                # 用法说明
 *   node tools/valuation.js <spec.json>           # 输出 markdown 情景表
 *   node tools/valuation.js                       # （兼容）运行内置示例
 *
 * spec.json 格式：
 * {
 *   "macro": { "rf": 0.018, "nominalGdpGrowth": 4 },        // 可选，默认即此值
 *   "tables": [
 *     {
 *       "kind": "theta",                         // θ 情景表：固定增速、变 θ
 *       "title": "θ 情景表（固定一致预期增速 [6.3%, 13.5%, 14.3%]）",
 *       "growthForecasts": [0.063, 0.135, 0.143],
 *       "eps": 7.14,                             // 基准年 EPS，折算股价用
 *       "rows": [
 *         { "name": "无折价", "theta0": 1.0, "thetaX": 1.0 },
 *         { "name": "基准",   "theta0": 0.95, "thetaX": 0.90 }
 *       ]
 *     },
 *     {
 *       "kind": "growth",                        // 增速情景表：固定 θ、变增速
 *       "title": "增速情景表（θ 固定基准 0.907）",
 *       "theta0": 0.95, "thetaX": 0.90,
 *       "currentPrice": 164.03,                  // 现价，用于"相对现价"列
 *       "rows": [
 *         { "name": "[0%, 5%, 6%]（悲观）", "growthForecasts": [0, 0.05, 0.06], "eps": 6.71 }
 *         // 行内可覆盖 θ（用于"谨慎增速 + 保守 θ"双维情景）：
 *         // { "name": "双保守", "growthForecasts": [0.03, 0.08, 0.09], "eps": 6.92, "theta0": 0.85, "thetaX": 0.85 }
 *       ]
 *     }
 *   ]
 * }
 *
 * 每张表还支持可选 "transitionYears"（默认 3）覆盖过渡期年数。
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * 三段式利润估值 + 整体兑现折价
 *
 * 约定：
 * 1. company.growthForecasts 为未来三年利润增速预测 [g1, g2, g3]
 * 2. 函数内部默认当前利润 np0 = 1，因此最终直接返回 PE
 * 3. 程序不负责计算 DP0 = NP_adj,0 + DA0 - MC0 - ΔWC^norm,0
 * 4. company.theta0 由外部分析得到：theta0 = DP0 / NP_adj,0
 * 5. company.thetaX 为成熟阶段或长期阶段兑现系数
 * 6. 过渡期统一 3 年（风险补偿，不调整，见估值模型.md“补充说明”）；按“第三年增长率线性衰减，终值起点收敛到终局增速”处理
 *
 * @param {Object} params
 * @param {Object} params.company - 公司层面参数
 * @param {number[]} params.company.growthForecasts - 三年利润增速预测 [g1, g2, g3]
 * @param {number} params.company.theta0 - 当前兑现系数
 * @param {number} params.company.thetaX - 长期兑现系数
 * @param {number} [params.company.transitionYears=3] - 过渡期年数；模型规定统一 3 年（风险补偿），本参数仅作敏感性实验，研报基准一律用 3
 * @param {number} [params.company.nearTermWeight=0.15] - 前三年权重，默认 15%
 * @param {number} [params.company.longTermWeight=0.85] - 长期权重，默认 85%
 *
 * @param {Object} params.macro - 宏观层面参数
 * @param {number} params.macro.rf - 无风险利率，例如 0.018
 * @param {number} params.macro.nominalGdpGrowth - 名义 GDP 增速 m 的数字输入，例如 4 表示 4%
 * @param {number} [params.macro.equityRiskPremium=0.055] - 固定股权风险补偿，默认 5.5%
 *
 * @returns {number} finalPe
 */
function calculateIntrinsicPe({ company, macro }) {
  const {
    growthForecasts,
    theta0,
    thetaX,
    transitionYears = 3,
    nearTermWeight = 0.15,
    longTermWeight = 0.85,
  } = company || {};

  const {
    rf,
    nominalGdpGrowth,
    equityRiskPremium = 0.055,
  } = macro || {};

  if (!Array.isArray(growthForecasts) || growthForecasts.length !== 3) {
    throw new Error("company.growthForecasts 必须是长度为 3 的数组，例如 [0.12, 0.10, 0.08]");
  }

  const [g1, g2, g3] = growthForecasts;

  const nums = {
    g1,
    g2,
    g3,
    theta0,
    thetaX,
    transitionYears,
    nearTermWeight,
    longTermWeight,
    rf,
    nominalGdpGrowth,
    equityRiskPremium,
  };

  for (const [key, value] of Object.entries(nums)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${key} 必须是有限数字`);
    }
  }

  if (!Number.isInteger(transitionYears) || transitionYears < 0) {
    throw new Error("transitionYears 必须是大于等于 0 的整数");
  }

  if (Math.abs(nearTermWeight + longTermWeight - 1) > 1e-8) {
    throw new Error("nearTermWeight 与 longTermWeight 之和必须等于 1");
  }

  if (g1 <= -1 || g2 <= -1 || g3 <= -1) {
    throw new Error("growthForecasts 中每个增速都必须大于 -1；当前版本不考虑亏损情形");
  }

  const R = rf + equityRiskPremium;
  const gInfinity = (0.35 * nominalGdpGrowth / (1 + 0.35 * nominalGdpGrowth)) * 0.04;

  if (R <= gInfinity) {
    throw new Error("折现率 R 必须大于终局增速 g∞");
  }

  // 内部标准化：np0 = 1
  const np0 = 1;
  const np1 = np0 * (1 + g1);
  const np2 = np1 * (1 + g2);
  const np3 = np2 * (1 + g3);

  const pvFirst3 =
    np1 / Math.pow(1 + R, 1) +
    np2 / Math.pow(1 + R, 2) +
    np3 / Math.pow(1 + R, 3);

  const profitSeries = [np1, np2, np3];
  let pvTransition = 0;
  const N = 3 + transitionYears;

  for (let t = 4; t <= N; t++) {
    const step = (t - 3) / (transitionYears + 1);
    const gt = g3 + step * (gInfinity - g3);

    const prevProfit = profitSeries[profitSeries.length - 1];
    const currentProfit = prevProfit * (1 + gt);

    if (currentProfit <= 0) {
      throw new Error("过渡期利润小于等于 0；当前版本不考虑亏损情形");
    }

    profitSeries.push(currentProfit);
    pvTransition += currentProfit / Math.pow(1 + R, t);
  }

  const npN = profitSeries[profitSeries.length - 1];
  const npN1 = npN * (1 + gInfinity);

  const terminalValue = npN1 / (R - gInfinity);
  const pvTerminal = terminalValue / Math.pow(1 + R, N);

  const basePe = pvFirst3 + pvTransition + pvTerminal;
  const theta = nearTermWeight * theta0 + longTermWeight * thetaX;

  return basePe * theta;
}

/* ───────────────────────── 情景生成器（CLI） ───────────────────────── */

const DEFAULT_MACRO = { rf: 0.018, nominalGdpGrowth: 4 };

/** 渲染一张 θ 情景表（固定增速、变 θ） */
function renderThetaTable(table, macro) {
  const { title, growthForecasts, eps, rows, transitionYears = 3 } = table;
  const header = `| 情景 | θ₀ | θₓ | θ | 内在 PE | 对应股价（2026E EPS ${eps}） |`;
  const sep = `| --- | ---: | ---: | ---: | ---: | ---: |`;
  const body = rows
    .map((r) => {
      const theta = 0.15 * r.theta0 + 0.85 * r.thetaX;
      const pe = calculateIntrinsicPe({
        company: { growthForecasts, theta0: r.theta0, thetaX: r.thetaX, transitionYears },
        macro,
      });
      const price = pe * eps;
      return `| ${r.name} | ${r.theta0.toFixed(2)} | ${r.thetaX.toFixed(2)} | ${theta.toFixed(3)} | ${pe.toFixed(1)}x | ~${Math.round(price)} 元 |`;
    })
    .join('\n');
  return `**${title}**\n\n${header}\n${sep}\n${body}`;
}

/** 渲染一张增速情景表（固定 θ、变增速；行内可覆盖 θ） */
function renderGrowthTable(table, macro) {
  const { title, theta0, thetaX, currentPrice, rows, transitionYears = 3 } = table;
  const header = `| 三年增速（归母口径） | 2026E EPS | 内在 PE | 对应股价 | 相对现价 ${currentPrice} 元 |`;
  const sep = `| --- | ---: | ---: | ---: | ---: |`;
  const fmtG = (x) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
  const body = rows
    .map((r) => {
      // 行级 θ 覆盖：用于"谨慎增速 + 保守 θ"这类双维情景
      const t0 = r.theta0 ?? theta0;
      const tx = r.thetaX ?? thetaX;
      const theta = 0.15 * t0 + 0.85 * tx;
      const pe = calculateIntrinsicPe({
        company: { growthForecasts: r.growthForecasts, theta0: t0, thetaX: tx, transitionYears },
        macro,
      });
      const price = pe * r.eps;
      const rel = ((price / currentPrice - 1) * 100).toFixed(0);
      const relStr = Number(rel) >= 0 ? `+${rel}%` : `${rel}%`;
      const g = r.growthForecasts.map(fmtG).join(', ');
      // 行名已自带增速（如 "[6.3%, 13.5%, 14.3%]（基准）"）时不再重复追加
      const label = r.name.includes('[') ? r.name : `${r.name}（[${g}]）`;
      return `| ${label} | ${r.eps} | ${pe.toFixed(1)}x | ~${Math.round(price)} 元 | ${relStr} |`;
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

示例 spec 见文件头注释；tables 支持 kind="theta"（固定增速变 θ）与 kind="growth"（固定 θ 变增速）。`;

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
    // 兼容：运行内置示例
    const pools = {
      zgzm: { growthForecasts: [0.2, 0.1, 0.12], theta0: 0.9, thetaX: 0.9 },
      byd: { growthForecasts: [0.27, 0.26, 0.19], theta0: 0.1, thetaX: 0.6 },
    };
    Object.keys(pools).forEach((key) => {
      const finalPe = calculateIntrinsicPe({
        company: { transitionYears: 3, ...pools[key] },
        macro: DEFAULT_MACRO,
      });
      console.log(`${key}: ${finalPe.toFixed(2)}`);
    });
  }
}

export { calculateIntrinsicPe };
