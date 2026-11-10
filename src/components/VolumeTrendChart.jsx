import { useEffect, useRef } from 'react';
// 按需引入（tree-shaking），与 KlineChart 同一套路
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkPointComponent,
  MarkLineComponent,
  AxisPointerComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkPointComponent,
  MarkLineComponent,
  AxisPointerComponent,
  CanvasRenderer,
]);

const ACCENT = '#4c8dff';      // 今日
const PREV = '#8b93a1';        // 昨日
const PREV_AREA = 'rgba(139,147,161,0.10)';
const UP = '#ef5350';
const DOWN = '#1fc08f';

const GRID_LEFT = 60;
const GRID_RIGHT = 64;

/** 午休后第一根是 13:01（接口没有 13:00 这一行），展示层统一叫 13:00 */
const displayTime = (t) => (t === '13:01' ? '13:00' : t);

/** 横轴展示的时点（其余刻度隐去，避免 241 个标签糊成一片） */
const AXIS_TICKS = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];

/** 成交量（手）→ 展示串：亿手 / 万手 */
function fmtVolume(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿手`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万手`;
  return `${n.toFixed(0)}手`;
}

/** 成交额（元）→ 展示串：亿元 / 万元 */
function fmtAmount(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return `${n.toFixed(0)}元`;
}

/**
 * 大盘分时量能对比图：上格累计曲线（今日 vs 昨日），下格每分钟量柱
 *
 * @param {object} props
 * @param {Array} props.rows compareIntradayVolumes().rows：按分钟槽位对齐的对比行
 * @param {'volume'|'amount'} props.metric 指标（量 / 额）
 * @param {object} props.summary 汇总指标
 * @param {string} props.title 图表标题
 */
export default function VolumeTrendChart({ rows, metric, summary, title }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = echarts.init(containerRef.current, null, { renderer: 'canvas' });
    chartRef.current = chart;
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !rows || rows.length === 0) return;

    const isVolume = metric === 'volume';
    const fmt = isVolume ? fmtVolume : fmtAmount;
    const cumToday = rows.map((r) => (isVolume ? r.todayCumVolume : r.todayCumAmount));
    const cumPrev = rows.map((r) => (isVolume ? r.prevCumVolume : r.prevCumAmount));
    // 每分钟额由累计额差分还原（rows 只带累计额，避免两套字段重复）
    const minTodayValue = rows.map((r, i) => {
      if (r.time == null) return null;
      if (isVolume) return r.todayVolume;
      if (r.todayCumAmount == null) return null;
      const prevCum = i > 0 ? rows[i - 1].todayCumAmount : null;
      return prevCum == null ? r.todayCumAmount : r.todayCumAmount - prevCum;
    });
    const minPrevValue = rows.map((r, i) => {
      if (isVolume) return r.prevVolume;
      if (r.prevCumAmount == null) return null;
      const prevCum = i > 0 ? rows[i - 1].prevCumAmount : null;
      return prevCum == null ? r.prevCumAmount : r.prevCumAmount - prevCum;
    });

    const times = rows.map((r) => displayTime(r.time));
    const lastIdx = cumToday.reduce((acc, v, i) => (v == null ? acc : i), -1);
    const prevFull = isVolume ? summary?.volume.prevCumFull : summary?.amount.prevCumFull;

    const axisBase = {
      axisLine: { lineStyle: { color: '#2f3742' } },
      axisLabel: { color: '#8b93a1', fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: '#232a34' } },
    };

    const tooltipRows = (idx) => {
      const r = rows[idx];
      if (!r) return '';
      const row = (label, value, color) => `<div style="display:flex;justify-content:space-between;gap:18px">
          <span style="color:#8b93a1">${label}</span>
          <span style="color:${color || '#e6e9ef'}">${value}</span>
        </div>`;
      const todayCum = isVolume ? r.todayCumVolume : r.todayCumAmount;
      const prevCum = isVolume ? r.prevCumVolume : r.prevCumAmount;
      const diff = todayCum != null && prevCum != null ? todayCum - prevCum : null;
      const diffPct = diff != null && prevCum ? (diff / prevCum) * 100 : null;
      return `<div style="min-width:200px;font-size:12px;line-height:1.75">
        <div style="font-weight:600;margin-bottom:4px">${displayTime(r.time)}</div>
        ${row('今日累计', todayCum == null ? '—' : fmt(todayCum), ACCENT)}
        ${row('昨日累计', prevCum == null ? '—' : fmt(prevCum), PREV)}
        ${row('同期差', diff == null
          ? '—'
          : `${diff > 0 ? '+' : ''}${fmt(diff).replace('—', '')}（${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%）`,
          diff == null ? '#8b93a1' : diff >= 0 ? UP : DOWN)}
        <div style="border-top:1px solid #2b323d;margin:4px 0"></div>
        ${row('今日该分钟', minTodayValue[idx] == null ? '—' : fmt(minTodayValue[idx]), ACCENT)}
        ${row('昨日该分钟', minPrevValue[idx] == null ? '—' : fmt(minPrevValue[idx]), PREV)}
      </div>`;
    };

    const option = {
      animation: false,
      backgroundColor: 'transparent',
      title: {
        text: title,
        subtext: isVolume ? '单位：成交量（手）· 每点为该分钟量并按日累加' : '单位：成交额（元）· 每点为该分钟额并按日累加',
        left: 8,
        top: 2,
        textStyle: { fontSize: 15, fontWeight: 600, color: '#e6e9ef' },
        subtextStyle: { fontSize: 11, color: '#7d8797' },
      },
      legend: {
        top: 6,
        right: 12,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { fontSize: 11, color: '#8b93a1' },
        data: ['今日累计', '昨日累计'],
      },
      grid: [
        { left: GRID_LEFT, right: GRID_RIGHT, top: '16%', height: '48%' },
        { left: GRID_LEFT, right: GRID_RIGHT, top: '74%', height: '17%' },
      ],
      xAxis: [0, 1].map((i) => ({
        type: 'category',
        gridIndex: i,
        data: times,
        // 两格都用 boundaryGap:true —— 否则上格线图从 y 轴线起步、下格柱子在类目中心起，
        // 同一分钟在上下两格会错开半格，十字光标联动时看起来不齐
        boundaryGap: true,
        axisLine: { lineStyle: { color: '#2f3742' } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#8b93a1',
          fontSize: 11,
          interval: (index, value) => AXIS_TICKS.includes(value),
          formatter: (v) => v,
          hideOverlap: true,
        },
        axisPointer: { label: { show: i === 1, formatter: (p) => p.value } },
      })),
      yAxis: [0, 1].map((i) => ({
        type: 'value',
        gridIndex: i,
        scale: true,
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisBase.axisLabel, formatter: fmt },
        splitLine: axisBase.splitLine,
      })),
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#5c6572' }, lineStyle: { color: '#3a4351' } },
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
      series: [
        {
          name: '昨日累计',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: cumPrev,
          step: 'end',
          showSymbol: false,
          lineStyle: { width: 1.4, color: PREV },
          itemStyle: { color: PREV },
          areaStyle: { color: PREV_AREA },
          z: 2,
        },
        {
          name: '今日累计',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: cumToday,
          step: 'end',
          showSymbol: false,
          lineStyle: { width: 2, color: ACCENT },
          itemStyle: { color: ACCENT },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(76,141,255,0.35)' },
                { offset: 1, color: 'rgba(76,141,255,0.02)' },
              ],
            },
          },
          z: 3,
          // 两条参考线：横向虚线 = 昨日全天水平；纵向实线 = 今日已走到的分钟位置
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              ...(prevFull == null ? [] : [{
                yAxis: prevFull,
                lineStyle: { color: '#5b6472', type: 'dashed', width: 1 },
                label: {
                  formatter: `昨日全天 ${fmt(prevFull)}`,
                  position: 'insideEndTop',
                  fontSize: 10,
                  color: '#8b93a1',
                  backgroundColor: 'rgba(22,27,34,0.9)',
                  padding: [2, 4],
                },
              }]),
              ...(lastIdx < 0 ? [] : [{
                xAxis: times[lastIdx],
                lineStyle: { color: '#3f4a5a', type: 'solid', width: 1 },
                label: {
                  formatter: `${displayTime(times[lastIdx])} 此刻`,
                  position: 'end',
                  fontSize: 10,
                  color: '#7d8797',
                },
              }]),
            ],
          },
          /**
           * 今日曲线末端只留一个圆点，不挂文字标签：
           * 数值已由「此刻」竖线 + 上方指标卡表达，重复标注只会挡住曲线。
           * ⚠ 用 coord 定位的 markPoint，label formatter 里的 p.value 是 [时间, 值] 数组，
           *   照抄成 fmt(p.value) 会被 Number() 转成 NaN → 渲染成占位符「—」（2026-11-10 修过）。
           */
          markPoint: lastIdx < 0 ? undefined : {
            symbol: 'circle',
            symbolSize: 7,
            silent: true,
            itemStyle: { color: ACCENT, borderColor: '#0e1116', borderWidth: 2 },
            label: { show: false },
            data: [{ coord: [times[lastIdx], cumToday[lastIdx]] }],
          },
        },
        {
          name: '昨日每分钟',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: minPrevValue,
          barWidth: '62%',
          itemStyle: { color: 'rgba(139,147,161,0.35)' },
          legendHoverLink: false,
          z: 1,
        },
        {
          name: '今日每分钟',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          // barGap: '-100%' 让今日柱子叠在昨日柱子的正中，露出的灰边即为昨日更高的部分
          data: minTodayValue,
          barWidth: '34%',
          barGap: '-100%',
          itemStyle: { color: 'rgba(76,141,255,0.9)' },
          legendHoverLink: false,
          z: 2,
        },
      ],
    };

    chart.setOption(option, true);
  }, [rows, metric, summary, title]);

  return (
    <div
      ref={containerRef}
      className="volume-canvas"
      role="img"
      aria-label={`${title}：大盘分时${metric === 'volume' ? '成交量' : '成交额'}昨日与今日对比`}
    />
  );
}
