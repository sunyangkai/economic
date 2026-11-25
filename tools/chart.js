/**
 * 研报图表生成（纯计算，不取外部数据）
 *
 * 管线：spec JSON → ECharts SSR（SVG 字符串）→ resvg 光栅化 → PNG 落盘。
 * 全程纯 Node，不依赖浏览器、Python、matplotlib——中文与负号在服务端直接渲染正确。
 *
 * 为什么不用 AI 生图：研报图表的数字必须与正文同源。AI 生成图会编造数值，
 * 只能用于插画封面；一切带坐标轴、带数值的图都必须走本工具。
 *
 * ── CLI 用法 ────────────────────────────────────────────────────────
 *   node tools/chart.js --help                  # 用法说明
 *   node tools/chart.js <spec.json>             # 按 spec 出图（输出路径写在 spec.output）
 *   node tools/chart.js <spec.json> --out a.png # 覆盖输出路径
 *   node tools/chart.js <spec.json> --scale 3   # 覆盖输出倍率（默认 2）
 *
 * ── spec.json 结构 ──────────────────────────────────────────────────
 * ⚠ 目录约定：**数据与图片分开放**
 *   spec（数据源）→ doc/知识库/行业/<行业>/图表/数据/<图名>.spec.json
 *   PNG（成品）  → doc/知识库/行业/<行业>/图表/图片/<图名>.png
 *   只出 PNG，不产出 SVG。
 *
 * {
 *   "title": "总标题",                     // 可选
 *   "subtitle": "数据口径 / 来源",          // 可选
 *   "width": 1500, "height": 900,          // 画布逻辑尺寸（像素），默认 1400×800
 *   "scale": 2,                            // 输出倍率，默认 2（= 2x 分辨率）
 *   "output": "doc/知识库/行业/<行业>/图表/<图名>.png",
 *   "theme": { "colors": ["#2c6fbb", "#e0a32e"], "background": "#ffffff" },  // 可选
 *   "panels": [                            // 1 个或多个子图（多子图自动均分纵向空间）
 *     {
 *       "title": "① 挖掘机单月销量同比",
 *       "grid": { "left": "7%", "right": "4%", "top": "12%", "height": "34%" },  // 可选，不写则自动
 *       "categories": ["1月", "2月", "…"],           // x 轴类目
 *       "yLabel": "同比 %",
 *       "valueFormat": { "suffix": "%", "showSign": true, "decimals": 0 },
 *       "labelFormat": { "suffix": "%", "showSign": true, "decimals": 1 },  // 数据标签
 *       "series": [
 *         { "name": "总销量", "type": "line", "data": [49.5, -10.6, 26.4],
 *           "color": "#1f3f6e", "smooth": false, "label": false },
 *         { "name": "国内销量", "type": "bar", "data": [61.4, -42.0, 23.5], "label": true }
 *       ],
 *       "markArea": [ { "from": "7月", "to": "10月", "color": "rgba(192,57,43,.07)",
 *                       "label": "7—10 月：增速下台阶" } ],
 *       "markLine":  [ { "y": 10, "label": "外需证伪阈值 10%", "color": "#c0392b" } ],
 *       "zeroLine": true,                    // 是否画 y=0 基线（默认 true，有负值时必要）
 *       "yMin": null, "yMax": null           // 可选，手动固定 y 轴范围
 *     }
 *   ]
 * }
 *
 * series 字段：type('bar'|'line')、data、name、color、label、labelSize、labelBold、
 *   smooth、width（线宽）、symbol、barMaxWidth、yAxisIndex（1 = 右侧第二 y 轴）。
 * 同一 panel 只要有系列写 yAxisIndex:1，就自动建第二条 y 轴（配 yLabelRight）。
 *
 * 数据标签纪律：label 为 true 时正值标在柱/点上方、负值自动落到下方，不用手工调位置。
 * 负号一律用 ASCII '-'（部分字体缺 U+2212，会渲染成豆腐块）。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as echarts from 'echarts';
import { Resvg } from '@resvg/resvg-js';

/** 研报默认配色：蓝（主）/ 橙（辅）/ 红（预警）/ 绿（正向）/ 灰（中性） */
const DEFAULT_COLORS = ['#2c6fbb', '#e0a32e', '#c0392b', '#1a7f5a', '#7f8c8d', '#6b4c9a', '#0f8b8d'];

/** 中文字体栈：macOS / Windows / Linux 三端常见黑体，resvg 按序命中系统已装字体 */
const FONT_STACK = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, Heiti SC, sans-serif';

const DEFAULT_WIDTH = 1400;
const DEFAULT_HEIGHT = 800;
const DEFAULT_SCALE = 2;

/** 数值格式化：按 valueFormat / labelFormat 统一口径 */
function makeFormatter(fmt = {}) {
  const { suffix = '', showSign = false, decimals = 0, thousands = false } = fmt;
  return (v) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '';
    const abs = thousands
      ? Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : Math.abs(v).toFixed(decimals);
    const sign = v < 0 ? '-' : showSign && v > 0 ? '+' : '';
    return `${sign}${abs}${suffix}`;
  };
}

/**
 * 把 ECharts 的尺寸写法折算成像素：数字原样返回，"12%"/"50%" 按画布总高折算。
 * 用于把 grid.top / grid.height 参与标题排版计算（ECharts 自己没有这个 API）。
 * @param {number|string|undefined} v
 * @param {number} total 画布在对应方向上的总尺寸（纵向排版传 height）
 * @returns {number} 折算后的像素；无法折算时返回 NaN
 */
function toPx(v, total) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const m = v.trim().match(/^(-?\d+(?:\.\d+)?)%$/);
    if (m) return (parseFloat(m[1]) / 100) * total;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

/** 把 "7月" 或下标解析成类目下标 */
function toCategoryIndex(categories, ref) {
  if (typeof ref === 'number') return ref;
  const idx = categories.indexOf(ref);
  if (idx < 0) throw new Error(`markArea 的 "${ref}" 不在 categories 里：${categories.join(', ')}`);
  return idx;
}

/**
 * 单 panel → ECharts 片段
 * @param {object} panel
 * @param {number} panelIndex
 * @param {object} spec
 * @param {{yAxisOffset:number}} ctx 该 panel 的 y 轴在全局 yAxis 数组里的起始下标
 */
function buildPanel(panel, panelIndex, spec, ctx) {
  // ctx.heightPx = 该 panel 的 grid 高度，用于自适应刻度密度
  const categories = panel.categories || [];
  if (!categories.length) throw new Error(`panels[${panelIndex}] 缺少 categories`);

  const colors = (spec.theme && spec.theme.colors) || DEFAULT_COLORS;
  const series = panel.series || [];
  if (!series.length) throw new Error(`panels[${panelIndex}] 缺少 series`);

  const valueFmt = makeFormatter(panel.valueFormat || {});
  const labelFmt = makeFormatter(panel.labelFormat || panel.valueFormat || {});
  const needSecondAxis = series.some((s) => s.yAxisIndex === 1);

  // y 轴刻度自适应：轴高越小，刻度越少（避免 10% 一格把标签压成一坨）
  const splitNumber = panel.splitNumber || ctx.heightPx < 160 ? 4 : 5;

  // y 轴范围交给 ECharts 自动计算：它自带的「零对齐 + 整数刻度」算法
  // （1/2/5×10^n 步长、负值自动向下取整）比手写边界更稳。手写 min/max 反而会
  // 破坏它的算法，产出 -54% / +74% 这类刻度（实测踩坑）。需要固定范围时显式给
  // panel.yMin / panel.yMax 即可。
  const { yMin, yMax } = panel;

  const yAxis = [
    {
      type: 'value',
      name: panel.yLabel || '',
      nameTextStyle: { fontSize: 11, color: '#555' },
      axisLabel: { fontSize: 10, color: '#555', formatter: valueFmt },
      splitLine: { lineStyle: { color: '#e6e6e6', type: 'dashed' } },
      axisLine: { show: false },
      splitNumber,
      min: yMin ?? undefined,
      max: yMax ?? undefined,
    },
  ];
  if (needSecondAxis) {
    yAxis.push({
      type: 'value',
      name: panel.yLabelRight || '',
      nameTextStyle: { fontSize: 11, color: '#555' },
      axisLabel: { fontSize: 10, color: '#555', formatter: makeFormatter(panel.valueFormatRight || {}) },
      splitLine: { show: false },
      axisLine: { show: false },
      min: panel.yMinRight ?? undefined,
      max: panel.yMaxRight ?? undefined,
    });
  }

  const builtSeries = series.map((s, si) => {
    const type = s.type === 'line' ? 'line' : 'bar';
    const color = s.color || colors[si % colors.length];
    const out = {
      name: s.name,
      type,
      data: s.data,
      xAxisIndex: panelIndex,
      yAxisIndex: ctx.yAxisOffset + (s.yAxisIndex || 0),
      z: s.z ?? 2,
    };

    if (type === 'line') {
      out.lineStyle = { width: s.width || 2.2, color };
      out.itemStyle = { color };
      out.symbol = s.symbol || 'circle';
      out.symbolSize = s.symbolSize || 6;
      out.smooth = !!s.smooth;
    } else {
      out.itemStyle = { color, borderRadius: s.rounded ? [3, 3, 0, 0] : 0 };
      out.barMaxWidth = s.barMaxWidth || 34;
      // 同 panel 内多个 bar 系列走分组并列（ECharts 默认行为，显式写明以免误改）
      out.barGap = s.barGap || '30%';
    }

    // 数据标签：柱状图默认显示（研报图需能直接读数），折线默认不显示（避免糊成一片）；
    // spec 里写 "label": true / false 可显式覆盖。
    //
    // ⚠ 负值柱必须逐点指定 position:'bottom'：整条 series 设 position:'top' 时，
    // 负值柱的标签会被压在 y=0 轴上（不是柱底），这是 ECharts 的相对定位语义。
    // 所以柱状图默认走「逐点 data + 按符号给 position」，折线仍用 series 级 label。
    const showLabel = s.label !== undefined ? s.label : type === 'bar';
    if (showLabel) {
      const labelStyle = {
        show: true,
        distance: 4,
        fontSize: s.labelSize || 10,
        color: s.labelColor || color,
        fontWeight: s.labelBold ? 'bold' : 'normal',
      };

      if (type === 'bar') {
        // 逐点数据：数值 + 按符号定标签位置
        out.data = (Array.isArray(s.data) ? s.data : []).map((v) => ({
          value: v,
          label: {
            ...labelStyle,
            position: typeof v === 'number' && v < 0 ? 'bottom' : 'top',
            formatter: labelFmt(v),
          },
        }));
        // series 级 label 关掉，避免与逐点 label 叠加
        out.label = { show: false };
      } else {
        out.label = {
          ...labelStyle,
          position: 'top',
          formatter: (pt) => labelFmt(pt.value),
        };
      }
    }
    return out;
  });

  // markArea：区间高亮，挂第一个系列（ECharts 语义）
  if (panel.markArea && panel.markArea.length) {
    builtSeries[0].markArea = {
      silent: true,
      itemStyle: { color: 'rgba(192,57,43,.07)' },
      data: panel.markArea.map((a) => {
        const from = toCategoryIndex(categories, a.from);
        const to = toCategoryIndex(categories, a.to);
        return [
          {
            xAxis: categories[from],
            itemStyle: a.color ? { color: a.color } : undefined,
            label: {
              show: !!a.label,
              position: 'insideTop',
              formatter: a.label || '',
              fontSize: 10,
              color: '#c0392b',
              fontWeight: 'bold',
            },
          },
          { xAxis: categories[to] },
        ];
      }),
    };
  }

  // markLine：水平阈值线（y）或类目竖线（x）
  if (panel.markLine && panel.markLine.length) {
    builtSeries[0].markLine = {
      silent: true,
      symbol: 'none',
      data: panel.markLine.map((l) => {
        const line =
          l.x !== undefined
            ? { xAxis: typeof l.x === 'number' ? categories[l.x] : l.x }
            : { yAxis: l.y };
        line.lineStyle = {
          color: l.color || '#888',
          type: l.dashed === false ? 'solid' : 'dashed',
          width: 1.2,
        };
        line.label = {
          show: !!l.label,
          formatter: l.label || '',
          position: l.position || 'insideEndTop',
          fontSize: 10,
          color: l.color || '#666',
        };
        return line;
      }),
    };
  }

  return { yAxis, series: builtSeries };
}

/**
 * spec → ECharts option（纯函数，可单独复用）
 * @param {object} spec 见文件头结构说明
 * @returns {object} ECharts option
 */
export function buildOption(spec) {
  const panels = spec.panels || [];
  if (!panels.length) throw new Error('spec 缺少 panels');

  const colors = (spec.theme && spec.theme.colors) || DEFAULT_COLORS;
  const background = (spec.theme && spec.theme.background) || '#ffffff';
  const width = spec.width || DEFAULT_WIDTH;
  const height = spec.height || DEFAULT_HEIGHT;

  // 布局全部用像素计算：ECharts 的 title / legend 不接受 CSS calc()，
  // 混用百分比会把这些组件全部回落到顶部（实测踩坑）。
  // 总标题区高度：手写 grid 且顶部很靠上时（如 top:90），子图标题要挤进去，
  // 这里按需要保底一个「总标题 + 副标题」的最小高度，避免两行标题叠在一起。
  const headerPx = spec.title ? 76 : spec.subtitle ? 40 : 16; // 总标题区高度
  const headerMin = (spec.title ? 34 : 0) + (spec.subtitle ? 22 : 0) + 10;
  const panelTitlePx = 26; // 每个子图标题占位
  const legendPx = 18; // 每个子图图例占位
  const gapPx = 26; // 子图之间的留白
  const axisBottomPx = 44; // 最底部 x 轴标签区

  const perPanel = (height - headerPx - axisBottomPx - gapPx * (panels.length - 1)) / panels.length;

  const option = {
    animation: false, // SSR 必须关动画，否则截到的是第一帧
    backgroundColor: background,
    color: colors,
    textStyle: { fontFamily: FONT_STACK },
    title: [],
    grid: [],
    xAxis: [],
    yAxis: [],
    series: [],
    legend: [],
  };

  if (spec.title) {
    option.title.push({
      text: spec.title,
      left: 'center',
      top: 14,
      textStyle: { fontSize: spec.titleSize || 19, fontWeight: 'bold', color: '#1a1a1a', fontFamily: FONT_STACK },
    });
  }
  if (spec.subtitle) {
    option.title.push({
      text: spec.subtitle,
      left: 'center',
      top: spec.title ? 44 : 14,
      textStyle: { fontSize: 11, color: '#777', fontWeight: 'normal', fontFamily: FONT_STACK },
    });
  }

  let yAxisOffset = 0;
  panels.forEach((p, i) => {
    // 自动布局：每个 panel 顶部预留「子图标题 + 图例」
    const panelTop = headerPx + i * (perPanel + gapPx);
    const gridTop = panelTop + panelTitlePx + (p.series.length >= 2 ? legendPx : 0);
    const grid = p.grid || {
      left: '8%',
      right: '5%',
      top: gridTop,
      height: Math.max(60, perPanel - panelTitlePx - (p.series.length >= 2 ? legendPx : 0) - 26),
    };
    // 手写 grid 时，标题/图例要贴着 grid 顶部往上排（否则会掉回画布顶部压住图）。
    // grid.top 允许写百分比（ECharts 原生支持），这里统一折算成像素再排标题；
    // 折算不了（如 'center'）就退回自动布局的位置。
    const gridTopPx = toPx(grid.top, height);
    const titleAt = Number.isFinite(gridTopPx)
      ? Math.max(headerMin, gridTopPx - panelTitlePx - (p.series.length >= 2 ? legendPx : 0))
      : panelTop;

    // 子图标题上移后，grid 也要相应下压，否则标题仍会压住柱子
    if (Number.isFinite(gridTopPx)) {
      const need = titleAt + panelTitlePx + (p.series.length >= 2 ? legendPx : 0);
      if (need > gridTopPx) {
        grid.top = need;
        const h = toPx(grid.height, height);
        grid.height = Math.max(60, (Number.isFinite(h) ? h : perPanel) - (need - gridTopPx));
      }
    }
    option.grid.push(grid);

    const { yAxis, series } = buildPanel(p, i, spec, {
      yAxisOffset,
      heightPx: toPx(grid.height, height) || 200,
    });
    yAxis.forEach((y) => option.yAxis.push({ ...y, gridIndex: i }));
    series.forEach((s) => option.series.push(s));
    option.xAxis.push({
      type: 'category',
      data: p.categories,
      gridIndex: i,
      axisLabel: { fontSize: 10, color: '#444', fontFamily: FONT_STACK },
      axisTick: { alignWithLabel: true },
      axisLine: { lineStyle: { color: '#bbb' } },
    });

    // 子图标题：随 grid 顶部走
    if (p.title) {
      option.title.push({
        text: p.title,
        left: 'center',
        top: titleAt,
        textStyle: {
          fontSize: p.titleSize || 14,
          fontWeight: 'bold',
          color: '#222',
          fontFamily: FONT_STACK,
        },
      });
    }

    // 每个 panel 一个 legend 组件（ECharts 允许多个 legend，各显示各自 series 名）
    if (series.length >= 2) {
      const names = series.map((s) => s.name).filter(Boolean);
      option.legend.push({
        data: names,
        top: titleAt + panelTitlePx - 4,
        left: 'center',
        itemWidth: 14,
        itemHeight: 8,
        itemGap: 16,
        textStyle: { fontSize: 10, color: '#444', fontFamily: FONT_STACK },
      });
    }

    yAxisOffset += yAxis.length;
  });

  // 无图例时不输出空数组，避免 ECharts 画空图例占位
  if (!option.legend.length) delete option.legend;
  if (!option.title.length) delete option.title;

  return option;
}

/** spec → SVG 字符串（ECharts SSR） */
export function renderSvg(spec) {
  const width = spec.width || DEFAULT_WIDTH;
  const height = spec.height || DEFAULT_HEIGHT;
  const option = buildOption(spec);
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
  try {
    chart.setOption(option);
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}

/** SVG 字符串 → PNG Buffer（resvg，按 scale 放大） */
export function svgToPng(svg, scale = DEFAULT_SCALE) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts: true, defaultFontFamily: 'PingFang SC' },
    background: 'white',
  });
  return resvg.render().asPng();
}

/**
 * 出图主函数：spec → 落盘
 * @param {object} spec
 * @param {object} [opts]
 * @param {string}  [opts.out]   覆盖 spec.output
 * @param {number}  [opts.scale] 覆盖 spec.scale
 * @returns {{ png: string, width: number, height: number }}
 */
export function renderChart(spec, opts = {}) {
  // 先校验 spec 本身（panels 等），再校验落盘参数——否则空 panels 会误报成"缺 output"
  if (!spec || !Array.isArray(spec.panels) || !spec.panels.length) {
    throw new Error('spec 缺少 panels（至少 1 个子图）');
  }
  const out = opts.out || spec.output;
  if (!out) throw new Error('spec 缺少 output，或用 --out 指定输出路径');
  const scale = opts.scale || spec.scale || DEFAULT_SCALE;

  const svg = renderSvg(spec);
  const png = svgToPng(svg, scale);

  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, png);

  return {
    png: out,
    width: (spec.width || DEFAULT_WIDTH) * scale,
    height: (spec.height || DEFAULT_HEIGHT) * scale,
  };
}

const USAGE = `用法:
  node tools/chart.js --help                  # 本说明
  node tools/chart.js <spec.json>             # 按 spec 出图（输出路径见 spec.output）
  node tools/chart.js <spec.json> --out a.png # 覆盖输出路径
  node tools/chart.js <spec.json> --scale 3   # 覆盖输出倍率（默认 2）

管线：spec JSON → ECharts SSR（SVG 内存态）→ resvg → PNG 落盘。纯 Node，不需要 Python / 浏览器。
只出 PNG。数据（spec）与图片（png）分两处存：图表/数据/ 与 图表/图片/。
研报图必须用本工具（数字与正文同源）；AI 生图只能做插画封面，不得用于带数值的图。

spec 结构见 tools/chart.js 文件头注释：panels[] 每项含 categories / series / grid /
markArea / markLine / valueFormat / labelFormat；多子图 = 多个 panels。`;

/** CLI 入口：直接执行本文件时运行（import 时不执行） */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const args = process.argv.slice(2);

  // 解析参数：第一个非 flag 且非 flag 取值的位置即 spec 路径
  const flagsWithValue = new Set(['--out', '--scale']);
  let specPath;
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out' || a === '--scale') {
      const v = args[++i];
      if (a === '--out') opts.out = v;
      else opts.scale = Number(v);
    } else if (a === '--svg') {
      console.warn('⚠ --svg 已废弃：本工具只出 PNG（数据与图片分开存于 图表/数据 与 图表/图片）。已忽略该参数。');
    } else if (!a.startsWith('--') && !specPath) {
      specPath = a;
    }
  }

  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(args.length ? 0 : 1);
  }
  if (!specPath) {
    console.error('缺少 spec.json 路径。用 --help 看用法。');
    process.exit(1);
  }

  try {
    const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
    const r = renderChart(spec, opts);
    console.log(`✓ ${r.png}（${r.width}×${r.height}px）`);
  } catch (err) {
    console.error(`出图失败：${err.message}`);
    process.exit(1);
  }
}
