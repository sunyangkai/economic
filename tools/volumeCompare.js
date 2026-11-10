/**
 * 大盘分时成交量「昨日 vs 今日」对比计算（纯函数，不取外部数据）
 *
 * 输入是 api/trends.js 的 `getIndexTrends()` 返回的 `days`：
 *   [{ date: '2026-11-09', points: [{ time: '09:30', price, volume, amount }, ...] }, ...]
 * 其中 volume = 该分钟的成交量（手），amount = 该分钟的成交额（元）。
 *
 * 本模块只做三件事：
 *  1. 取最近两个交易日（今日 / 昨日；今日未开盘时自动变成「昨日 / 前日」，口径写在返回值里）；
 *  2. 按分钟槽位对齐（昨日是完整 241 个槽位，今日未收盘时只有已走出的部分）；
 *  3. 逐分钟累加成**累计曲线**并算出对比指标（同期差、倍数、按昨日节奏推算全天等）。
 *
 * 为什么可以直接比「分钟成交量」而不做差分：api/trends.js 文档里实测过，
 * 东财分时的 f56 / f57 本身就是「该分钟的量与额」，不是累计值。
 */

/** 时间字符串 'HH:MM' 的比较（同日内按字典序即为时间序） */
const byTime = (a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0);

/**
 * 从多日分时里取最近两个交易日
 * @param {Array<{date:string, points:Array}>} days 按日期升序
 * @returns {{today: object|null, prev: object|null}}
 *   命名沿用「今日 / 昨日」的展示语义：today = 最近一日，prev = 前一日
 */
export function pickLatestTwoDays(days) {
  const list = (Array.isArray(days) ? days : []).filter((d) => d && d.points && d.points.length);
  if (!list.length) return { today: null, prev: null };
  return {
    today: list[list.length - 1],
    prev: list.length >= 2 ? list[list.length - 2] : null,
  };
}

/** 单日逐分钟数据 → 累计量 / 额（保持原顺序） */
function accumulate(day) {
  let cumVolume = 0;
  let cumAmount = 0;
  const points = day.points.map((p) => {
    cumVolume += p.volume;
    cumAmount += p.amount;
    return { ...p, cumVolume, cumAmount };
  });
  return {
    date: day.date,
    points,
    lastTime: points.length ? points[points.length - 1].time : null,
    cumVolume,
    cumAmount,
    minutes: points.length,
  };
}

/**
 * 对比最近两个交易日的分时成交量
 * @param {Array<{date:string, points:Array}>} days 升序的多日分时
 * @param {object} [options]
 * @param {number} [options.minuteBarRatio=0] 预留：分时量柱缩放，本函数不使用
 * @returns {object} 见下方返回值说明
 *
 * 返回：
 *   today / prev        = 两日的逐分钟累计序列（today.points[i] 含 volume、cumVolume、cumAmount）
 *   rows                = 按「昨日完整槽位 ∪ 今日已走槽位」对齐后的对比行：
 *                         { time, todayVolume, prevVolume, todayCumVolume, prevCumVolume,
 *                           todayCumAmount, prevCumAmount }，今日未走到的槽位为 null
 *   summary             = 汇总指标（同期 = 今日最后已走分钟这一刻）
 *     · volume/amount 各自给出 todayCum、prevCumSame（昨日同一时刻累计）、prevCumFull（昨日全天）
 *     · diff、diffPct  ：今日同期 − 昨日同期，及百分比
 *     · ratio          ：今日同期 / 昨日同期（倍数）
 *     · paceVolume     ：按昨日「同期占全天比例」外推的今日全天量
 *     · paceDiffPct    ：推算全天量相对昨日全天的变化
 */
export function compareIntradayVolumes(days) {
  const { today: todayDay, prev: prevDay } = pickLatestTwoDays(days);
  if (!todayDay) {
    return { today: null, prev: null, rows: [], summary: null };
  }

  const today = accumulate(todayDay);
  const prev = prevDay ? accumulate(prevDay) : null;

  // 槽位并集：以昨日完整槽位为骨架，再接上今日独有的槽位（理论上不会有）
  const timeSet = new Set();
  if (prev) prev.points.forEach((p) => timeSet.add(p.time));
  today.points.forEach((p) => timeSet.add(p.time));
  const times = [...timeSet].sort();

  const todayByTime = new Map(today.points.map((p) => [p.time, p]));
  const prevByTime = prev ? new Map(prev.points.map((p) => [p.time, p])) : new Map();

  const rows = times.map((time) => {
    const t = todayByTime.get(time);
    const p = prevByTime.get(time);
    return {
      time,
      todayVolume: t ? t.volume : null,
      prevVolume: p ? p.volume : null,
      todayCumVolume: t ? t.cumVolume : null,
      prevCumVolume: p ? p.cumVolume : null,
      todayCumAmount: t ? t.cumAmount : null,
      prevCumAmount: p ? p.cumAmount : null,
    };
  });

  const summary = buildSummary(today, prev);
  return { today, prev, rows, summary };
}

/** 汇总指标：同期对比 + 按昨日节奏外推全天 */
function buildSummary(today, prev) {
  const lastTime = today.lastTime;
  const prevSame = prev ? prev.points.find((p) => p.time === lastTime) : null;

  const todayCumVolume = today.cumVolume;
  const todayCumAmount = today.cumAmount;
  const prevCumVolumeSame = prevSame ? prevSame.cumVolume : null;
  const prevCumAmountSame = prevSame ? prevSame.cumAmount : null;
  const prevCumVolumeFull = prev ? prev.cumVolume : null;
  const prevCumAmountFull = prev ? prev.cumAmount : null;

  const diffOf = (cur, base) =>
    cur == null || base == null || !Number.isFinite(base) ? null : cur - base;
  const pctOf = (cur, base) => {
    if (cur == null || base == null || !Number.isFinite(base) || base === 0) return null;
    return ((cur - base) / base) * 100;
  };
  const ratioOf = (cur, base) =>
    cur == null || base == null || !Number.isFinite(base) || base === 0 ? null : cur / base;

  // 按昨日「同刻累计 / 全天累计」的比例，把今日同刻累计外推成全天
  const paceOf = (curSame, baseSame, baseFull) => {
    if (curSame == null || baseSame == null || baseFull == null) return null;
    if (!Number.isFinite(baseSame) || baseSame <= 0) return null;
    return (curSame / baseSame) * baseFull;
  };
  const paceVolume = paceOf(todayCumVolume, prevCumVolumeSame, prevCumVolumeFull);
  const paceAmount = paceOf(todayCumAmount, prevCumAmountSame, prevCumAmountFull);

  return {
    lastTime,
    todayDate: today.date,
    prevDate: prev ? prev.date : null,
    /** 今日已走的交易分钟数 / 昨日全天分钟数（横轴是否走满的判定依据） */
    todayMinutes: today.minutes,
    prevMinutes: prev ? prev.minutes : null,
    volume: {
      todayCum: todayCumVolume,
      prevCumSame: prevCumVolumeSame,
      prevCumFull: prevCumVolumeFull,
      diff: diffOf(todayCumVolume, prevCumVolumeSame),
      diffPct: pctOf(todayCumVolume, prevCumVolumeSame),
      ratio: ratioOf(todayCumVolume, prevCumVolumeSame),
      pace: paceVolume,
      paceDiffPct: pctOf(paceVolume, prevCumVolumeFull),
    },
    amount: {
      todayCum: todayCumAmount,
      prevCumSame: prevCumAmountSame,
      prevCumFull: prevCumAmountFull,
      diff: diffOf(todayCumAmount, prevCumAmountSame),
      diffPct: pctOf(todayCumAmount, prevCumAmountSame),
      ratio: ratioOf(todayCumAmount, prevCumAmountSame),
      pace: paceAmount,
      paceDiffPct: pctOf(paceAmount, prevCumAmountFull),
    },
  };
}

/**
 * 分时「量能节奏」描述：把今日累计曲线与昨日同时点曲线相比，给出偏放量 / 偏缩量判断
 * （纯文本结论，供页面提示条使用；不给投资建议，只描述数据）
 */
export function describePace(summary) {
  if (!summary || summary.volume.diffPct == null) return null;
  const pct = summary.volume.diffPct;
  const abs = Math.abs(pct);
  if (abs < 3) return '与前一日同刻基本持平';
  return pct > 0
    ? `较前一日同刻放量 ${pct.toFixed(1)}%`
    : `较前一日同刻缩量 ${abs.toFixed(1)}%`;
}

export default { compareIntradayVolumes, pickLatestTwoDays, describePace };
