import { memo } from "./cache";
import { buildLiveNewsImpacts } from "./intel/marketmind";
import { getOrderFlow } from "./intel/orderflow";
import { getSectorSpotlight } from "./intel/sosovalue";
import { getTopMarkets } from "./tokens/markets";

export type SentimentInputs = {
  /** Top-50 (stablecoins excluded): how many are up over 24h and 7d. */
  breadth: { total: number; up24h: number; up7d: number } | null;
  news: { bullish: number; bearish: number; neutral: number } | null;
  sectors: { total: number; up: number } | null;
  /** Taker buy share (0..1) for the major pairs. */
  flow: { ratios: number[] } | null;
};

export type SentimentComponent = { key: "breadth" | "news" | "sectors" | "flow"; label: string; score: number; detail: string };
export type Sentiment = {
  score: number;
  label: "Risk-on" | "Risk-off" | "Mixed";
  /** How many of the four inputs were available. */
  used: number;
  confidence: "high" | "medium" | "low";
  components: SentimentComponent[];
  generatedAt: number;
};

const WEIGHTS = { breadth: 0.35, news: 0.25, sectors: 0.2, flow: 0.2 } as const;
const clamp = (n: number, lo = -100, hi = 100) => Math.max(lo, Math.min(hi, n));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
/** A share between 0 and 1 mapped to -100..100 around 50%. */
const around = (share: number) => clamp((share - 0.5) * 200);

/**
 * Pure: one transparent score in -100..100 from whatever inputs are available. Missing inputs are left out and
 * the remaining weights are rescaled, so one provider being down lowers confidence instead of faking a reading.
 */
export function computeSentiment(i: SentimentInputs, now = Date.now()): Sentiment | null {
  const components: SentimentComponent[] = [];
  if (i.breadth && i.breadth.total >= 10) {
    const s = (around(i.breadth.up24h / i.breadth.total) + around(i.breadth.up7d / i.breadth.total)) / 2;
    components.push({ key: "breadth", label: "Market breadth", score: Math.round(s), detail: `${pct(i.breadth.up24h, i.breadth.total)}% of the top ${i.breadth.total} are up over 24h, ${pct(i.breadth.up7d, i.breadth.total)}% over 7d` });
  }
  if (i.news) {
    const total = i.news.bullish + i.news.bearish + i.news.neutral;
    if (total >= 3) {
      components.push({ key: "news", label: "News tone", score: Math.round(clamp(((i.news.bullish - i.news.bearish) / total) * 100)), detail: `${i.news.bullish} bullish, ${i.news.bearish} bearish, ${i.news.neutral} neutral headlines` });
    }
  }
  if (i.sectors && i.sectors.total >= 3) {
    components.push({ key: "sectors", label: "Sector breadth", score: Math.round(around(i.sectors.up / i.sectors.total)), detail: `${i.sectors.up} of ${i.sectors.total} sectors are up over 24h` });
  }
  if (i.flow && i.flow.ratios.length > 0) {
    const avg = i.flow.ratios.reduce((a, b) => a + b, 0) / i.flow.ratios.length;
    components.push({ key: "flow", label: "Order flow", score: Math.round(around(avg)), detail: `Buyers took ${(avg * 100).toFixed(0)}% of recent trades on the major pairs` });
  }
  if (components.length < 2) return null; // one input is not a market view
  const weight = components.reduce((s, c) => s + WEIGHTS[c.key], 0);
  const score = Math.round(components.reduce((s, c) => s + c.score * WEIGHTS[c.key], 0) / weight);
  return {
    score,
    label: score >= 20 ? "Risk-on" : score <= -20 ? "Risk-off" : "Mixed",
    used: components.length,
    confidence: components.length >= 4 ? "high" : components.length === 3 ? "medium" : "low",
    components,
    generatedAt: now,
  };
}

/** Gathers the four inputs in parallel. Any that fail are simply left out. */
async function gather(): Promise<SentimentInputs> {
  const [top, news, sectors, btc, eth] = await Promise.allSettled([
    getTopMarkets(50),
    buildLiveNewsImpacts(10),
    getSectorSpotlight(),
    getOrderFlow("BTC"),
    getOrderFlow("ETH"),
  ]);
  const rows = top.status === "fulfilled" ? top.value.filter((r) => !r.isStable) : [];
  const ratios = [btc, eth].flatMap((r) => (r.status === "fulfilled" ? [r.value.takerBuyRatio] : []));
  return {
    breadth: rows.length ? { total: rows.length, up24h: rows.filter((r) => (r.change24h ?? 0) > 0).length, up7d: rows.filter((r) => (r.change7d ?? 0) > 0).length } : null,
    news: news.status === "fulfilled" && news.value.items.length ? {
      bullish: news.value.items.filter((n) => n.sentiment === "bullish").length,
      bearish: news.value.items.filter((n) => n.sentiment === "bearish").length,
      neutral: news.value.items.filter((n) => n.sentiment === "neutral").length,
    } : null,
    sectors: sectors.status === "fulfilled" && sectors.value.data.length ? { total: sectors.value.data.length, up: sectors.value.data.filter((s) => s.change24h > 0).length } : null,
    flow: ratios.length ? { ratios } : null,
  };
}

/** The live market sentiment, cached for five minutes. Throws if fewer than two inputs are available. */
export function getSentiment(): Promise<Sentiment> {
  return memo("sentiment", 5 * 60_000, async () => {
    const s = computeSentiment(await gather());
    if (!s) throw new Error("Not enough live data to read the market right now");
    return s;
  });
}
