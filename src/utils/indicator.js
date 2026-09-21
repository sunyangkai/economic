/**
 * K 线技术指标计算（纯函数，无依赖）
 *
 * 口径说明：
 *  - MA(n)：收盘价的 n 期简单移动平均，不足 n 期返回 null（图中断线，不用 0 填充）。
 *  - EMA(n)：指数移动平均，首值取首个收盘价（与通达信/同花顺 EMA 初值口径一致）。
 *  - MACD：DIF = EMA12 − EMA26；DEA = EMA9(DIF)；MACD 柱 = (DIF − DEA) × 2（国内惯例乘 2）。
 *  - RSI(n)：Wilder 平滑（首值用前 n 期均价作种子），非简单均值版本。
 */

/** 简单移动平均 */
export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  if (n <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** 指数移动平均 */
export function ema(values, n) {
  const out = new Array(values.length).fill(null);
  if (values.length === 0 || n <= 0) return out;
  const k = 2 / (n + 1);
  out[0] = values[0];
  for (let i = 1; i < values.length; i += 1) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** MACD：返回 { dif, dea, macd } */
export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const dif = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const dea = ema(dif, signal);
  const bar = dif.map((v, i) => (v - dea[i]) * 2);
  return { dif, dea, macd: bar };
}

/** Wilder 平滑 RSI */
export function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / n;
  let avgLoss = loss / n;
  out[n] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = n + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (n - 1) + g) / n;
    avgLoss = (avgLoss * (n - 1) + l) / n;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** 把数值数组按指定位数取整（图表 tooltip 用，避免长小数） */
export function round(values, digits = 2) {
  return values.map((v) => (v == null ? null : Number(v.toFixed(digits))));
}
