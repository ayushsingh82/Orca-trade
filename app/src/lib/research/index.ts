import { getDaily, getHourly, RESEARCH_ASSETS } from "./prices";
import { resample, rsi, rsiSeries, zone, type Point, type Zone } from "./rsi";

export const TIMEFRAMES = ["1h", "4h", "24h", "7d"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type TimeframeRsi = { value: number | null; zone: Zone | null };

export type TokenResearch = {
  symbol: string;
  name: string;
  price: number;
  /** Percent change over the window, or null if the history does not cover it. */
  changes: { "1h": number | null; "24h": number | null; "7d": number | null; "30d": number | null };
  rsi: Record<Timeframe, TimeframeRsi>;
  /** Latest 1h RSI values for the last 7 days, to chart momentum. */
  rsi1hHistory: number[];
  /** Position inside the 365-day range: 0 = at the low, 100 = at the high. */
  rangePosition365d: number;
  high365d: number;
  low365d: number;
  /** Fraction of timeframes that are oversold or overbought, for the summary line. */
  summary: string;
  updatedAt: number;
};

function changeOver(points: Point[], ms: number): number | null {
  const last = points[points.length - 1];
  const target = last.t - ms;
  if (points[0].t > target + ms * 0.1) return null;
  let ref = points[0];
  for (const p of points) {
    if (p.t <= target) ref = p;
    else break;
  }
  return (last.p / ref.p - 1) * 100;
}

const wrap = (value: number | null): TimeframeRsi => ({ value, zone: value == null ? null : zone(value) });

function summarize(rsis: Record<Timeframe, TimeframeRsi>): string {
  const known = TIMEFRAMES.filter((t) => rsis[t].value != null);
  const over = known.filter((t) => rsis[t].zone === "overbought").map((t) => t);
  const under = known.filter((t) => rsis[t].zone === "oversold").map((t) => t);
  if (over.length) return `Overbought on ${over.join(", ")}`;
  if (under.length) return `Oversold on ${under.join(", ")}`;
  const avg = known.reduce((s, t) => s + (rsis[t].value as number), 0) / (known.length || 1);
  return avg > 55 ? "Momentum leaning strong" : avg < 45 ? "Momentum leaning weak" : "No extreme reading";
}

export async function researchToken(symbol: string): Promise<TokenResearch> {
  const asset = RESEARCH_ASSETS.find((a) => a.symbol === symbol.toUpperCase());
  if (!asset) throw new Error(`Unknown token ${symbol}`);
  const [hourly, daily] = await Promise.all([getHourly(asset.id), getDaily(asset.id)]);

  const h1 = resample(hourly, HOUR);
  const h4 = resample(hourly, 4 * HOUR);
  // 24h and 7d use daily history so the RSI window covers 14 days and 14 weeks.
  const d1 = resample(daily, DAY);
  const w1 = resample(daily, 7 * DAY);

  const rsis: Record<Timeframe, TimeframeRsi> = {
    "1h": wrap(rsi(h1)),
    "4h": wrap(rsi(h4)),
    "24h": wrap(rsi(d1)),
    "7d": wrap(rsi(w1)),
  };
  const price = hourly[hourly.length - 1].p;
  const prices365 = daily.map((p) => p.p);
  const high = Math.max(...prices365, price);
  const low = Math.min(...prices365, price);
  return {
    symbol: asset.symbol,
    name: asset.name,
    price,
    changes: {
      "1h": changeOver(hourly, HOUR),
      "24h": changeOver(hourly, DAY),
      "7d": changeOver(hourly, 7 * DAY),
      "30d": changeOver(daily, 30 * DAY),
    },
    rsi: rsis,
    rsi1hHistory: rsiSeries(h1).slice(-168),
    rangePosition365d: high === low ? 50 : ((price - low) / (high - low)) * 100,
    high365d: high,
    low365d: low,
    summary: summarize(rsis),
    updatedAt: Math.max(hourly[hourly.length - 1].t, Date.now() - 15 * 60_000),
  };
}

/** All research tokens, sequentially so the price history provider is not rate limited. Failures are reported per token. */
export async function researchAll(): Promise<{ tokens: TokenResearch[]; errors: Record<string, string> }> {
  const tokens: TokenResearch[] = [];
  const errors: Record<string, string> = {};
  for (const a of RESEARCH_ASSETS) {
    try {
      tokens.push(await researchToken(a.symbol));
    } catch (e) {
      errors[a.symbol] = e instanceof Error ? e.message : "failed";
    }
  }
  return { tokens, errors };
}
