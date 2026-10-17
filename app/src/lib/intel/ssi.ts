// SSI / index intelligence.
//
// Two surfaces:
//  1. Live SSI baskets — read /indices + /indices/{t}/constituents and join with
//     per-currency snapshots to compute live NAV, 24h change, and each
//     constituent's 24h contribution. Read-only research/comparison context.
//  2. The MarketMind Index — a COMPUTED, PUBLISHED methodology basket (market-cap
//     weighted with a single-name cap), NOT an on-chain mint. NAV is computed
//     from live constituent prices; throws without live data (no mock).

import { getMarketSnapshot, hasSosoKey, type MarketSnapshot } from "./sosovalue";
import { clamp, round } from "./analytics";

// ---------------------------------------------------------------------------
// The MarketMind Index (MMX) — computed, published methodology.
// ---------------------------------------------------------------------------

export type MmxConstituent = {
  symbol: string;
  targetWeight: number; // % after cap rule
  rawMarketCapWeight: number; // % before cap
  price: number;
  change24h: number;
  contribution24h: number;
};

export type MmxIndex = {
  name: string;
  ticker: string;
  methodology: {
    universe: string;
    weighting: string;
    singleNameCap: number; // %
    rebalance: string;
  };
  lastRebalanced: number; // epoch ms
  nav: number; // computed from constituent prices (rebased to 100 at inception weights)
  change24h: number;
  constituents: MmxConstituent[];
  convictionScore: number; // 0..100, engine's conviction in the basket
  source: string;
};

// Candidate universe for the MarketMind Index. Reference market caps (USD) are

// Kept to 5 names: the SoSoValue Demo plan allows 10 requests/min (1 id map + 1 snapshot each + news/sectors/macro).
const MMX_UNIVERSE = ["BTC", "ETH", "SOL", "BNB", "XRP"];

const SINGLE_NAME_CAP = 35; // %
// Inception timestamp for the published methodology (deterministic, demo-stable).
const MMX_INCEPTION = Date.UTC(2026, 4, 1); // 2026-05-01

export async function buildMarketMindIndex(): Promise<MmxIndex> {
  if (!hasSosoKey()) throw new Error("Missing SOSO_API_KEY");

  // One snapshot call per symbol (cached upstream). Symbols without a live
  // snapshot are dropped, never filled with reference values.
  const results = await Promise.allSettled(MMX_UNIVERSE.map((sym) => getMarketSnapshot(sym)));
  const snapshots = new Map<string, MarketSnapshot>();
  results.forEach((r, i) => {
    const snap = r.status === "fulfilled" ? r.value.data?.[0] : undefined;
    if (snap && snap.marketCap) snapshots.set(MMX_UNIVERSE[i], snap);
  });
  if (snapshots.size === 0) throw new Error("No live market snapshots available");

  // 1. Raw market-cap weights.
  const rows = [...snapshots.entries()].map(([symbol, snap]) => ({
    symbol,
    price: snap.price,
    change24h: snap.change24h,
    cap: snap.marketCap as number,
  }));
  const totalCap = rows.reduce((s, r) => s + r.cap, 0) || 1;
  const rawWeights = rows.map((r) => ({ ...r, rawWeight: (r.cap / totalCap) * 100 }));

  // 2. Apply single-name cap, redistribute excess proportionally to uncapped names.
  const capped = applySingleNameCap(rawWeights.map((r) => ({ symbol: r.symbol, weight: r.rawWeight })), SINGLE_NAME_CAP);

  const constituents: MmxConstituent[] = rawWeights.map((r) => {
    const targetWeight = capped.find((c) => c.symbol === r.symbol)?.weight ?? r.rawWeight;
    const contribution24h = round((targetWeight / 100) * r.change24h, 2);
    return {
      symbol: r.symbol,
      targetWeight: round(targetWeight, 1),
      rawMarketCapWeight: round(r.rawWeight, 1),
      price: round(r.price, r.price < 5 ? 4 : 2),
      change24h: round(r.change24h, 2),
      contribution24h,
    };
  });

  const change24h = round(constituents.reduce((s, c) => s + c.contribution24h, 0), 2);
  const nav = round(100 + change24h, 2); // rebased to 100, today's move applied

  // Conviction: higher when breadth is positive and concentrated leadership is healthy.
  const positives = constituents.filter((c) => c.change24h > 0).length;
  const breadth = positives / constituents.length;
  const convictionScore = clamp(Math.round(45 + breadth * 40 + (change24h > 0 ? 8 : -8)), 18, 95);

  return {
    name: "MarketMind Index",
    ticker: "MMX",
    methodology: {
      universe: "Top liquid crypto majors + highest-conviction narrative leaders (8 names)",
      weighting: "Market-cap weighted",
      singleNameCap: SINGLE_NAME_CAP,
      rebalance: "Monthly (1st, 00:00 UTC), or on >5pp single-name drift",
    },
    lastRebalanced: MMX_INCEPTION,
    nav,
    change24h,
    constituents,
    convictionScore,
    source: `SoSoValue live snapshot (${snapshots.size}/${MMX_UNIVERSE.length} assets)`,
  };
}

// Cap each weight at `cap`%, redistribute the overflow proportionally to names
// still under the cap, iterating until stable.
function applySingleNameCap(
  weights: { symbol: string; weight: number }[],
  cap: number,
): { symbol: string; weight: number }[] {
  const w = weights.map((x) => ({ ...x }));
  for (let iter = 0; iter < 10; iter++) {
    const over = w.filter((x) => x.weight > cap);
    if (over.length === 0) break;
    let excess = 0;
    for (const x of over) {
      excess += x.weight - cap;
      x.weight = cap;
    }
    const under = w.filter((x) => x.weight < cap - 1e-9);
    const underTotal = under.reduce((s, x) => s + x.weight, 0) || 1;
    for (const x of under) {
      x.weight += (x.weight / underTotal) * excess;
    }
  }
  // Renormalize to 100 to absorb rounding.
  const total = w.reduce((s, x) => s + x.weight, 0) || 1;
  for (const x of w) x.weight = (x.weight / total) * 100;
  return w;
}
