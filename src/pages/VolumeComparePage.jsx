import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VolumeTrendChart from '../components/VolumeTrendChart.jsx';
import { getIndexTrends, INDEX_OPTIONS } from '../../api/trends.js';
import { compareIntradayVolumes, describePace } from '../../tools/volumeCompare.js';
import { fmtAmount, fmtPct, trendColor } from '../utils/format.js';

const STORAGE_KEY = 'volume-page:index';
/** 拉 3 日是"今日未开盘 / 早盘刚开盘"时仍能凑出两个完整交易日 */
const NDAYS = 3;
/** 盘中自动刷新间隔（毫秒） */
const REFRESH_MS = 60 * 1000;

/**
 * 是否处于 A 股交易时段（含集合竞价前 15 分钟，覆盖 09:30 开盘数据到位）。
 * 只按「工作日 + 09:15—15:05」粗判，不处理法定节假日——节假日请求只会拿到上一交易日数据，无害。
 */
function isTradingSession(now = new Date()) {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 5;
}

/** 成交量（手）→ 万手 / 亿手，页面专用（format.js 的 fmtVolume 文案是「手」结尾，口径一致但单位档不同） */
function fmtVolHand(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿手`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万手`;
  return `${n.toFixed(0)}手`;
}

/** 成交额（元）→ 亿元 */
function fmtAmtYuan(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(0)}亿元`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万元`;
  return `${n.toFixed(0)}元`;
}

/** 带符号数值串：用于「同期差」 */
const signed = (v, fmt) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${v > 0 ? '+' : ''}${fmt(v)}`;
};

/** MM-DD，用在图例与标题上 */
const shortDate = (date) => (date ? date.slice(5) : '—');

export default function VolumeComparePage({ indexKey: routeIndex }) {
  // 优先用 URL 里的指数（可收藏 / 分享），否则退回上次选择
  const [indexKey, setIndexKey] = useState(() => (
    INDEX_OPTIONS.some((o) => o.key === routeIndex)
      ? routeIndex
      : localStorage.getItem(STORAGE_KEY) || 'sh'
  ));
  const [metric, setMetric] = useState('volume');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  /** 秒级倒计时刷新提示 */
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  /** 递增序号：切指数时丢弃过期响应 */
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError('');
    try {
      const trends = await getIndexTrends(indexKey, { ndays: NDAYS });
      if (seq !== requestSeq.current) return;
      const compared = compareIntradayVolumes(trends.days);
      setResult({ name: trends.name, days: trends.days, ...compared });
      setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
      setCountdown(REFRESH_MS / 1000);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err.message || '数据加载失败');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [indexKey]);

  // 切指数：立即重取，并把当前指数写回地址栏（replaceState 不产生历史记录、也不二次触发 hashchange）
  useEffect(() => {
    load();
    localStorage.setItem(STORAGE_KEY, indexKey);
    const target = `#/volume/${indexKey}`;
    if (window.location.hash !== target) window.history.replaceState(null, '', target);
  }, [load, indexKey]);

  // 外部（导航 / 手改地址）带来的指数变化，同步进状态
  useEffect(() => {
    if (routeIndex && INDEX_OPTIONS.some((o) => o.key === routeIndex) && routeIndex !== indexKey) {
      setIndexKey(routeIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIndex]);

  // 盘中自动刷新 + 倒计时：只在交易时段内跑（工作日 09:15—15:05），其余时间停表，避免无意义请求
  useEffect(() => {
    if (!isTradingSession()) {
      setCountdown(null);
      return undefined;
    }
    const tick = setInterval(() => {
      setCountdown((n) => {
        if (!isTradingSession()) { clearInterval(tick); return null; }
        if (n <= 1) {
          load();
          return REFRESH_MS / 1000;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [load]);

  const summary = result?.summary;
  const isVolume = metric === 'volume';
  const stat = summary ? summary[metric] : null;

  // 主对比卡片：当前指标口径下的核心数字
  const cards = useMemo(() => {
    if (!summary || !stat) return [];
    const paceLabel = isVolume ? '推算全天量' : '推算全天额';
    return [
      {
        label: `今日同期（${summary.lastTime}）`,
        value: isVolume ? fmtVolHand(stat.todayCum) : fmtAmtYuan(stat.todayCum),
        note: `已走 ${summary.todayMinutes} 分钟`,
        color: 'var(--c-accent)',
      },
      {
        label: `${shortDate(summary.prevDate)} 同刻`,
        value: isVolume ? fmtVolHand(stat.prevCumSame) : fmtAmtYuan(stat.prevCumSame),
        note: '前一日同一分钟累计',
        color: 'var(--c-text)',
      },
      {
        label: '同期差',
        value: `${signed(stat.diffPct, (v) => `${v.toFixed(1)}%`)}`,
        note: `差额 ${signed(stat.diff, isVolume ? fmtVolHand : fmtAmtYuan)}`,
        color: stat.diffPct == null ? 'var(--c-text-2)' : stat.diffPct >= 0 ? 'var(--c-up)' : 'var(--c-down)',
      },
      {
        label: paceLabel,
        value: isVolume ? fmtVolHand(stat.pace) : fmtAmtYuan(stat.pace),
        note: stat.paceDiffPct == null
          ? '按前一日节奏外推'
          : `较前一日全天 ${signed(stat.paceDiffPct, (v) => `${v.toFixed(1)}%`)}`,
        color: 'var(--c-text)',
      },
    ];
  }, [summary, stat, isVolume]);

  const paceText = summary ? describePace(summary) : null;
  const chartTitle = result
    ? `${result.name}　${shortDate(summary?.prevDate)} vs ${shortDate(summary?.todayDate)} 分时${isVolume ? '成交量' : '成交额'}累计`
    : '大盘分时量能对比';

  return (
    <div className="app">
      <header className="app-header">
        <h1>大盘分时量能对比</h1>
        <span className="app-header-note">
          昨日 vs 今日逐分钟对比 ｜ 数据源：东方财富分时（浏览器直连，60 秒自动刷新）
        </span>
      </header>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <div className="field">
          <span className="label">指数</span>
          <div className="segmented">
            {INDEX_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                className={o.key === indexKey ? 'seg active' : 'seg'}
                onClick={() => setIndexKey(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">指标</span>
          <div className="segmented">
            <button
              type="button"
              className={isVolume ? 'seg active' : 'seg'}
              onClick={() => setMetric('volume')}
            >
              成交量
            </button>
            <button
              type="button"
              className={!isVolume ? 'seg active' : 'seg'}
              onClick={() => setMetric('amount')}
            >
              成交额
            </button>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '加载中…' : '刷新'}
        </button>

        <span className="toolbar-note">
          {lastUpdated ? `更新于 ${lastUpdated}` : '尚未取数'}
          {countdown == null ? '　·　非交易时段（不自动刷新）' : `　·　${countdown}s 后自动刷新`}
        </span>
      </form>

      {error && <div className="alert">{error}</div>}

      {summary && (
        <div className="stat-cards">
          {cards.map((c) => (
            <div key={c.label} className="stat-card">
              <div className="stat-label">{c.label}</div>
              <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
              <div className="stat-note">{c.note}</div>
            </div>
          ))}
        </div>
      )}

      {paceText && (
        <div className={`pace-banner ${stat?.diffPct >= 0 ? 'up' : 'down'}`}>
          <b>{summary.lastTime}</b> 时，今日{isVolume ? '成交量' : '成交额'}
          <b style={{ color: trendColor(stat?.diffPct) }}>{paceText}</b>
          ；按前一日节奏外推全天
          <b>{isVolume ? fmtVolHand(stat?.pace) : fmtAmtYuan(stat?.pace)}</b>
          {stat?.paceDiffPct != null && `（${fmtPct(stat.paceDiffPct)}）`}
          {summary.prevDate && (
            <span className="pace-banner-note">前一日全天 {isVolume ? fmtVolHand(stat?.prevCumFull) : fmtAmtYuan(stat?.prevCumFull)}</span>
          )}
        </div>
      )}

      <div className="chart-card">
        {loading && !result && <div className="loading-mask">加载中…</div>}
        {result && result.rows.length > 0 ? (
          <VolumeTrendChart
            rows={result.rows}
            metric={metric}
            summary={summary}
            title={chartTitle}
          />
        ) : (
          !loading && !error && <div className="empty">暂无分时数据</div>
        )}
      </div>

      <footer className="app-footer">
        <span>
          口径：分时每点为该分钟成交量（额），按分钟累加为累计曲线；今日未收盘时曲线只到最新分钟，同期对比取同一分钟位置。
        </span>
        <span>数据仅供研究参考，不构成投资建议</span>
      </footer>
    </div>
  );
}
