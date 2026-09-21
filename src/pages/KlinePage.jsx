import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KlineChart from '../components/KlineChart.jsx';
import { getKline, PERIODS, ADJUSTS, supportsAdjust, displayCode, getPeriod } from '../../api/kline.js';
import { fmtPrice, fmtPct, fmtVolume, fmtAmount, trendColor, normalizeInput } from '../utils/format.js';

const MA_OPTIONS = [5, 10, 20, 30, 60];
const PRESETS = [
  { code: '600887', label: '伊利股份' },
  { code: '300760', label: '迈瑞医疗' },
  { code: '600519', label: '贵州茅台' },
  { code: '000001', label: '平安银行' },
  { code: 'sh000001', label: '上证指数' },
];
const COUNT_OPTIONS = [120, 250, 320, 500, 800];
/** 默认只勾选 20 日线；其余周期按需在均线按钮上叠加 */
const DEFAULT_MA = [20];
const STORAGE_KEY = 'kline-web:last-input';
/** 分钟线接口实测单次最多返回约 320 条 */
const MINUTE_MAX_COUNT = 320;

export default function App() {
  const [input, setInput] = useState(() => localStorage.getItem(STORAGE_KEY) || '600887');
  const [period, setPeriod] = useState('day');
  const [adjust, setAdjust] = useState('qfq');
  const [maPeriods, setMaPeriods] = useState(DEFAULT_MA);
  const [count, setCount] = useState(320);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  /** 递增序号：连续切换参数时丢弃过期响应，避免旧请求覆盖新结果 */
  const requestSeq = useRef(0);

  const periodDef = getPeriod(period);
  const adjustEnabled = supportsAdjust(period);
  // 分钟线接口只提供不复权数据：此处派生实际复权参数，不改动用户在日线下的选择
  const effectiveAdjust = adjustEnabled ? adjust : 'none';
  // 分钟线条数上限收敛到接口实际能力
  const effectiveCount = periodDef.kind === 'minute' ? Math.min(count, MINUTE_MAX_COUNT) : count;

  const load = useCallback(async (rawCode) => {
    const code = normalizeInput(rawCode);
    if (!code) {
      setError('请输入股票 / 指数代码，例如 600887、sz300760、hk00700');
      setData(null);
      return;
    }
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError('');
    try {
      const payload = await getKline(code, {
        period,
        adjust: effectiveAdjust,
        count: effectiveCount,
      });
      if (seq !== requestSeq.current) return; // 已有更新请求，丢弃本次结果
      setData(payload);
      setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
      localStorage.setItem(STORAGE_KEY, rawCode);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err.message || '数据加载失败');
      setData(null);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [period, effectiveAdjust, effectiveCount]);

  // 首次进入 + 参数变化后自动重载
  // 依赖只放"决定取数结果"的参数：input 变化需显式点「查询」，避免边输入边发请求
  useEffect(() => {
    load(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, effectiveAdjust, effectiveCount]);

  const onSubmit = (e) => {
    e.preventDefault();
    load(input);
  };

  const pickPreset = (code) => {
    setInput(code);
    load(code);
  };

  const toggleMa = (n) => {
    setMaPeriods((prev) => (prev.includes(n)
      ? prev.filter((x) => x !== n)
      : [...prev, n].sort((a, b) => a - b)));
  };

  const quote = data?.quote;
  const chartTitle = data ? `${data.name}　${displayCode(data.secid)}` : 'K 线图';
  /**
   * 副标题口径：一律以接口**实际生效**的复权为准（data.adjust），
   * 而不是用户在按钮上选的那个值 —— 指数 / 港股 / 美股没有复权数据，
   * 传了 qfq/hfq 也只会拿到不复权价，若照抄按钮文案就会显示"前复权"而数据其实未复权。
   */
  const subtitle = useMemo(() => {
    if (!data) return periodDef.label;
    const applied = ADJUSTS.find((a) => a.key === data.adjust)?.label || '不复权';
    const requested = ADJUSTS.find((a) => a.key === data.requestedAdjust)?.label;
    const adjustText = data.adjust === 'none' && requested && requested !== '不复权'
      ? `${applied}（该品种无${requested}数据，已按不复权处理）`
      : periodDef.kind === 'minute'
        ? `${applied}（分钟线无复权数据）`
        : applied;
    return [periodDef.label, adjustText, `共 ${data.candles.length} 根`].join('　·　');
  }, [periodDef, data]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>K 线行情</h1>
        <span className="app-header-note">
          React + webpack + ECharts ｜ 数据源：腾讯行情（浏览器直连，无代理）
        </span>
      </header>

      <form className="toolbar" onSubmit={onSubmit}>
        <div className="field field-code">
          <label htmlFor="code">股票代码</label>
          <input
            id="code"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="如 600887 / sz300760 / hk00700"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '加载中…' : '查询'}
        </button>

        <div className="field">
          <span className="label">周期</span>
          <div className="segmented">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={p.key === period ? 'seg active' : 'seg'}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">复权</span>
          <div className="segmented">
            {ADJUSTS.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={!adjustEnabled}
                className={a.key === effectiveAdjust ? 'seg active' : 'seg'}
                onClick={() => setAdjust(a.key)}
                title={adjustEnabled ? '' : '分钟线接口仅提供不复权数据'}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">均线</span>
          <div className="segmented">
            {MA_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={maPeriods.includes(n) ? 'seg active' : 'seg'}
                onClick={() => toggleMa(n)}
              >
                MA{n}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="count">条数</label>
          <select id="count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </form>

      <div className="presets">
        <span className="presets-label">快捷：</span>
        {PRESETS.map((p) => (
          <button
            key={p.code}
            type="button"
            className={normalizeInput(input) === p.code ? 'chip active' : 'chip'}
            onClick={() => pickPreset(p.code)}
          >
            {p.label} <em>{p.code}</em>
          </button>
        ))}
        {periodDef.kind === 'minute' && (
          <span className="presets-hint">分钟线单次最多返回 {MINUTE_MAX_COUNT} 根</span>
        )}
      </div>

      {error && <div className="alert">{error}</div>}

      {quote && (
        <div className="quote-bar">
          <span className="quote-name">{quote.name}</span>
          <span className="quote-price" style={{ color: trendColor(quote.change) }}>
            {fmtPrice(quote.price)}
          </span>
          <span style={{ color: trendColor(quote.change) }}>
            {quote.change > 0 ? '+' : ''}{fmtPrice(quote.change)}　{fmtPct(quote.changePct)}
          </span>
          <span className="quote-item">今开 <b>{fmtPrice(quote.open)}</b></span>
          <span className="quote-item">昨收 <b>{fmtPrice(quote.prevClose)}</b></span>
          <span className="quote-item">最高 <b>{fmtPrice(quote.high)}</b></span>
          <span className="quote-item">最低 <b>{fmtPrice(quote.low)}</b></span>
          <span className="quote-item">成交量 <b>{fmtVolume(quote.volume)}</b></span>
          <span className="quote-item">成交额 <b>{fmtAmount(quote.amount)}</b></span>
          {quote.turnoverRate != null && (
            <span className="quote-item">换手 <b>{quote.turnoverRate.toFixed(2)}%</b></span>
          )}
          {quote.peTtm != null && <span className="quote-item">PE(TTM) <b>{fmtPrice(quote.peTtm)}</b></span>}
          {quote.pb != null && <span className="quote-item">PB <b>{fmtPrice(quote.pb)}</b></span>}
          {quote.totalMv != null && (
            <span className="quote-item">总市值 <b>{fmtPrice(quote.totalMv, 1)}亿</b></span>
          )}
        </div>
      )}

      <div className="chart-card">
        {loading && <div className="loading-mask">加载中…</div>}
        {data && data.candles.length > 0 ? (
          <KlineChart
            candles={data.candles}
            title={chartTitle}
            maPeriods={maPeriods}
            periodLabel={subtitle}
          />
        ) : (
          !loading && !error && <div className="empty">输入代码后点击「查询」</div>
        )}
      </div>

      <footer className="app-footer">
        <span>数据仅供研究参考，不构成投资建议</span>
        {lastUpdated && <span>更新时间：{lastUpdated}</span>}
      </footer>
    </div>
  );
}
