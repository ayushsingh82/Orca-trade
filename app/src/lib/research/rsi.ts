export type Point = { t: number; p: number };

/** Wilder's RSI series. Entry i is the RSI at closes[i + period]; empty if there are not period + 1 closes. */
export function rsiSeries(closes: number[], period = 14): number[] {
  if (closes.length <= period) return [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const toRsi = () => (avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss));
  const out = [toRsi()];
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out.push(toRsi());
  }
  return out;
}

/** Latest RSI, or null if there is not enough history. */
export function rsi(closes: number[], period = 14): number | null {
  const s = rsiSeries(closes, period);
  return s.length ? s[s.length - 1] : null;
}

/** Closes of fixed-width buckets (the last price inside each), oldest first. The final bucket may be partial. */
export function resample(points: Point[], bucketMs: number): number[] {
  const out: number[] = [];
  let current = NaN;
  for (const { t, p } of [...points].sort((a, b) => a.t - b.t)) {
    const bucket = Math.floor(t / bucketMs);
    if (bucket !== current) {
      out.push(p);
      current = bucket;
    } else {
      out[out.length - 1] = p;
    }
  }
  return out;
}

export type Zone = "oversold" | "weak" | "neutral" | "strong" | "overbought";

export function zone(value: number): Zone {
  if (value <= 30) return "oversold";
  if (value >= 70) return "overbought";
  if (value < 45) return "weak";
  if (value > 55) return "strong";
  return "neutral";
}
