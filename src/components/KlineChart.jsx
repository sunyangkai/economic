import { useEffect, useRef } from 'react';
// 按需引入 ECharts 模块（tree-shaking）：全量 `import * as echarts from 'echarts'`
// 会打进约 1.3MB 的包，这里只注册 K 线图实际用到的图表与组件。
import * as echarts from 'echarts/core';
import { CandlestickChart, BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkPointComponent,
  AxisPointerComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  CandlestickChart,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkPointComponent,
  AxisPointerComponent,
  CanvasRenderer,
]);
import { sma } from '../utils/indicator.js';
import { fmtVolume } from '../utils/format.js';

/* A 股配色惯例：涨红、跌绿 */
const UP = '#ef5350';
const UP_BORDER = '#ff8a86';
const DOWN = '#1fc08f';
const DOWN_BORDER = '#5ce0b8';

const MA_CONFIG = [
  { n: 5, color: '#f5a623' },
  { n: 10, color: '#5b9bf8' },
  { n: 20, color: '#c07ff0' },
  { n: 30, color: '#2fd0d0' },
  { n: 60, color: '#b08968' },
];

/** 网格左右留白（px）：坐标轴与绘制区共用，平移灵敏度按绘制区宽度折算 */
const GRID_LEFT = 62;
const GRID_RIGHT = 58;

/**
 * 触控板双指滑动平移的跟手比例（2026-09-14 调参，只改这一个数即可调快慢）
 *
 * ECharts 内置 moveOnMouseWheel 把滚动位移硬分三档（窗口跨度的 0.05 / 0.15 / 0.4），
 * 触控板 delta 一越过阈值就从 5% 跳到 15%，连发时一秒能扫掉整个视窗——"过于灵敏"的根因。
 * 故关掉内置平移（moveOnMouseWheel: false），改自实现的比例式平移：
 *   step = 手指像素位移 / 绘制区宽度 × 当前窗口跨度 × PAN_GAIN
 * PAN_GAIN = 1 表示与"窗口内内容的跟手位移"1:1；0.6 ≈ 六成跟手速度。
 */
const PAN_GAIN = 0.6;

/** 单帧最多平移当前窗口的比例，防惯性滚动把视窗甩飞 */
const PAN_MAX_RATIO = 0.25;

/**
 * K 线主图（ECharts candlestick + 成交量副图）
 *
 * 网格布局固定两格：上方 K 线主图（含所选均线），下方成交量副图。
 * 不提供 MACD / RSI 副图——副图只保留成交量（2026-09-14 起）。
 *
 * @param {object} props
 * @param {Array} props.candles 形如 [{date, open, close, high, low, volume}]
 * @param {string} props.title 图表标题（证券名 + 代码）
 * @param {number[]} props.maPeriods 要绘制的均线周期（默认 [20]）
 * @param {string} [props.periodLabel] 周期标签，用于副标题
 */
export default function KlineChart({ candles, title, maPeriods, periodLabel }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  /** 当前视窗 [start, end]（百分比）的镜像；重绘时重置，用户缩放时由 datazoom 事件刷新 */
  const rangeRef = useRef(null);
  /** 待应用的滚动位移（px）与 rAF 句柄：把高频 wheel 合并成每帧一次平移 */
  const pendingPanPx = useRef(0);
  const rafRef = useRef(null);

  // 初始化 / 销毁实例
  useEffect(() => {
    const chart = echarts.init(containerRef.current, null, { renderer: 'canvas' });
    chartRef.current = chart;
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    // 视窗镜像：捏合缩放 / 拖滑块都会派发 dataZoom，据此保持 rangeRef 与真实视窗同步
    const handleDataZoom = (params) => {
      const one = params.batch && params.batch.length ? params.batch[0] : params;
      if (one && one.start != null && one.end != null) rangeRef.current = [one.start, one.end];
    };
    chart.on('datazoom', handleDataZoom);

    // 每帧只平移一次：把这一帧累积的像素位移换算成窗口位移
    const flushPan = () => {
      rafRef.current = null;
      const inst = chartRef.current;
      const range = rangeRef.current;
      const dx = pendingPanPx.current;
      pendingPanPx.current = 0;
      if (!inst || !range || !dx) return;
      const span = range[1] - range[0];
      const gridWidth = Math.max(1, inst.getWidth() - GRID_LEFT - GRID_RIGHT); // 绘制区宽度（去掉左右留白）
      const step = Math.max(
        -span * PAN_MAX_RATIO,
        Math.min(span * PAN_MAX_RATIO, (dx / gridWidth) * span * PAN_GAIN),
      );
      // 方向与 ECharts 一致：双指下滑（deltaY > 0）看更早的行情
      let start = range[0] - step;
      let end = start + span;
      if (start < 0) { start = 0; end = span; }
      if (end > 100) { end = 100; start = 100 - span; }
      rangeRef.current = [start, end];
      inst.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start, end });
    };

    /**
     * 触控板双指滑动平移（自实现，替代 ECharts 内置 moveOnMouseWheel）。
     *  · 带 ctrlKey 的 wheel = macOS 捏合手势 → 直接放行给 ECharts 的 zoomOnMouseWheel: 'ctrl'
     *  · 其余 wheel 一律平移，速度由 PAN_GAIN 控制（不再走内置的三档阶梯）
     */
    const handleWheel = (e) => {
      if (e.ctrlKey) return;
      const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!raw) return;
      // deltaMode：0 = 像素（触控板 / 高精度鼠标）、1 = 行、2 = 页
      pendingPanPx.current += raw * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushPan);
      e.preventDefault();   // 别触发页面级滚动
      e.stopPropagation();  // 捕获阶段就拦下：普通 wheel 由我们平移，不再进 zrender 的内置 roam
    };

    const dom = containerRef.current;
    /**
     * 必须挂在**捕获阶段**：zrender 的 RoamController 对任何 wheel 都会调 eventTool.stop()
     * （stopPropagation + preventDefault），冒泡阶段的监听会被它挡掉、根本收不到事件——
     * 2026-09-14 用 headless Chrome 逐层探针实测：wheel 只到 canvas 这一层，container 的冒泡监听收不到。
     */
    dom.addEventListener('wheel', handleWheel, { capture: true, passive: false });

    return () => {
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('wheel', handleWheel, { capture: true });
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      chart.off('datazoom', handleDataZoom);
      chart.dispose();
      chartRef.current = null;
      rangeRef.current = null;
    };
  }, []);

  // 数据 / 配置变化时重绘
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candles || candles.length === 0) return;

    const dates = candles.map((c) => c.date);
    const ohlc = candles.map((c) => [c.open, c.close, c.low, c.high]);
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c, i) => ({
      value: c.volume,
      itemStyle: {
        color: c.close >= c.open ? UP : DOWN,
        opacity: 0.75,
      },
    }));

    // 均线：只算被选中的周期
    const maSeries = MA_CONFIG.filter((m) => maPeriods.includes(m.n)).map((m) => ({
      name: `MA${m.n}`,
      type: 'line',
      data: sma(closes, m.n).map((v) => (v == null ? null : Number(v.toFixed(2)))),
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 1.2, color: m.color, opacity: 0.9 },
      itemStyle: { color: m.color },
      connectNulls: false,
    }));

    /* ── 网格与坐标轴：固定两格（K 线主图 + 成交量副图），无指标副图 ── */
    const grids = [
      { left: GRID_LEFT, right: GRID_RIGHT, top: '4%', height: '58%' },
      { left: GRID_LEFT, right: GRID_RIGHT, top: '68%', height: '15%' },
    ];

    const axisBase = {
      axisLine: { lineStyle: { color: '#2f3742' } },
      axisLabel: { color: '#8b93a1', fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: '#232a34' } },
    };

    const xAxes = grids.map((_, i) => ({
      type: 'category',
      data: dates,
      gridIndex: i,
      boundaryGap: true,
      axisLine: axisBase.axisLine,
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: i === grids.length - 1
        ? { ...axisBase.axisLabel, hideOverlap: true }
        : { show: false },
      min: 'dataMin',
      max: 'dataMax',
      axisPointer: { z: 100, label: { show: i === grids.length - 1 } },
    }));

    const yAxes = grids.map((_, i) => ({
      scale: true,
      gridIndex: i,
      position: 'right',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { ...axisBase.axisLabel, formatter: (v) => (i === 1 ? fmtVolume(v) : v.toFixed(2)) },
      splitLine: axisBase.splitLine,
    }));

    /* ── 副图序列 ───────────────────────────────────────────── */
    const volumeSeries = {
      name: '成交量',
      type: 'bar',
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: volumes,
      barWidth: '60%',
    };

    /* ── 十字光标 tooltip ───────────────────────────────────── */
    const maNames = maSeries.map((s) => s.name);
    const tooltipRows = (idx) => {
      const c = candles[idx];
      if (!c) return '';
      const prev = idx > 0 ? candles[idx - 1].close : null;
      const chg = prev ? ((c.close - prev) / prev) * 100 : null;
      const chgColor = chg == null ? '#8b93a1' : chg >= 0 ? UP : DOWN;
      const maLines = maSeries
        .map((s) => {
          const v = s.data[idx];
          return v == null
            ? ''
            : `<div style="display:flex;justify-content:space-between;gap:16px">
                 <span style="color:${s.itemStyle.color}">${s.name}</span>
                 <span style="color:${s.itemStyle.color}">${Number(v).toFixed(2)}</span>
               </div>`;
        })
        .join('');
      return `
        <div style="min-width:180px;font-size:12px;line-height:1.7">
          <div style="font-weight:600;margin-bottom:4px">${c.date}</div>
          <div style="display:flex;justify-content:space-between;gap:16px"><span>开</span><span>${c.open.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:16px"><span>高</span><span style="color:${UP}">${c.high.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:16px"><span>低</span><span style="color:${DOWN}">${c.low.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:16px"><span>收</span><span>${c.close.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:16px"><span>涨跌</span><span style="color:${chgColor}">${chg == null ? '—' : `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`}</span></div>
          <div style="display:flex;justify-content:space-between;gap:16px"><span>量</span><span>${fmtVolume(c.volume)}</span></div>
          ${maLines ? `<div style="border-top:1px solid #2b323d;margin-top:4px;padding-top:4px">${maLines}</div>` : ''}
        </div>`;
    };

    /* 默认视窗：最后一屏约 120 根，避免一次性挤 300+ 根看不清 */
    const visibleCount = 120;
    const zoomStart = dates.length > visibleCount
      ? ((dates.length - visibleCount) / dates.length) * 100
      : 0;
    rangeRef.current = [zoomStart, 100];

    const option = {
      animation: false,
      backgroundColor: 'transparent',
      title: {
        text: title,
        subtext: periodLabel,
        left: 8,
        top: 2,
        textStyle: { fontSize: 15, fontWeight: 600, color: '#e6e9ef' },
        subtextStyle: { fontSize: 11, color: '#7d8797' },
      },
      legend: {
        top: 6,
        left: 'center',
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { fontSize: 11, color: '#8b93a1' },
        data: [...maNames, '成交量'],
        selected: { 成交量: true },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#5c6572' } },
        backgroundColor: 'rgba(22,27,34,0.96)',
        borderColor: '#2b323d',
        borderWidth: 1,
        padding: 8,
        textStyle: { color: '#e6e9ef' },
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          return tooltipRows(p.dataIndex);
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }], label: { backgroundColor: '#3a4351' } },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: grids.map((_, i) => i),
          start: zoomStart,
          end: 100,
          /**
           * macOS 触控板手势映射（2026-09-14 调整，与用户操作习惯对齐）：
           *  · 双指滑动   → 普通 wheel 事件（无修饰键）→ 由组件内 handleWheel 自实现平移（内置 moveOnMouseWheel 已关，见 PAN_GAIN）
           *  · 双指捏合   → 浏览器发出 ctrlKey=true 的 wheel 事件 → 缩放：zoomOnMouseWheel: 'ctrl'
           *  · 单指拖动   → mousedown + mousemove（触控板需按下，鼠标即拖拽）→ 仍可平移：moveOnMouseMove
           * 三者互不冲突：只有带 ctrl 的 wheel 才缩放，其余 wheel 一律平移。
           */
          zoomOnMouseWheel: 'ctrl',
          moveOnMouseWheel: false,
          moveOnMouseMove: true,
          zoomOnMouseMove: false,
        },
        {
          type: 'slider',
          xAxisIndex: grids.map((_, i) => i),
          bottom: 8,
          height: 18,
          start: zoomStart,
          end: 100,
          borderColor: '#2b323d',
          backgroundColor: '#1b212a',
          dataBackground: {
            lineStyle: { color: '#3a4351' },
            areaStyle: { color: '#2a323d' },
          },
          fillerColor: 'rgba(76,141,255,0.18)',
          handleStyle: { color: '#4c8dff' },
          textStyle: { fontSize: 10, color: '#8b93a1' },
        },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: ohlc,
          itemStyle: {
            color: UP,
            color0: DOWN,
            borderColor: UP_BORDER,
            borderColor0: DOWN_BORDER,
          },
          // 主图极值标注（ECharts 官方 K 线示例同款写法）
          markPoint: {
            symbolSize: 42,
            label: { fontSize: 10, color: '#fff' },
            data: [
              { name: '最高', type: 'max', valueDim: 'highest', itemStyle: { color: UP } },
              { name: '最低', type: 'min', valueDim: 'lowest', itemStyle: { color: DOWN } },
            ],
          },
        },
        ...maSeries,
        volumeSeries,
      ],
    };

    chart.setOption(option, true);
  }, [candles, title, maPeriods, periodLabel]);

  // aria-label 同时承担无障碍说明与"当前图表口径"的可读描述
  return (
    <div
      ref={containerRef}
      className="kline-canvas"
      role="img"
      aria-label={`${title}：${periodLabel || ''} K 线图`}
    />
  );
}
