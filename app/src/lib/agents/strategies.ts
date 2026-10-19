import type { OrcaSignal } from "@/lib/signals";
import { isTradable } from "@/lib/exec/mints";
import type { Policy, Proposal } from "@/lib/risk/types";
import type { Strategy } from "@/db/schema";

export type StrategyOutput = { proposal: Proposal | null; rationale: string[]; citations: OrcaSignal["citations"] };

/** Latest RSI per timeframe for an asset (null when there is not enough history). */
export type AssetRsi = { "1h": number | null; "4h": number | null; "24h": number | null; "7d": number | null };

type Input = { signals: OrcaSignal[]; policy: Policy; positionsUsd: Record<string, number>; rsi?: Record<string, AssetRsi> };

const toProposal = (s: OrcaSignal, side: "buy" | "sell", sizeUsd: number, policy: Policy): Proposal => ({
  asset: s.asset,
  side,
  sizeUsd: Math.floor(sizeUsd * 100) / 100,
  maxSlippageBps: policy.maxSlippageBps,
  conviction: s.conviction,
  riskFlag: s.riskFlag,
});

const eligible = (s: OrcaSignal, policy: Policy) =>
  isTradable(s.asset) && policy.allowedAssets.map((a) => a.toUpperCase()).includes(s.asset);

const fmtPrice = (p: number) => `$${p.toLocaleString(undefined, { maximumFractionDigits: p < 10 ? 4 : 2 })}`;

/** What the agent saw right now, so a "no action" run still reports live data. Strongest conviction first. */
const watching = (pool: OrcaSignal[]) =>
  `Watching: ${[...pool].sort((a, b) => b.conviction - a.conviction).map((s) => `${s.asset} ${fmtPrice(s.price)} ${s.direction} ${s.conviction}`).join(" · ") || "nothing tradable"}`;

/** Momentum: follow the strongest directional signal. Sell what we hold when it turns short. */
function momentum({ signals, policy, positionsUsd }: Input): StrategyOutput {
  const pool = signals.filter((s) => eligible(s, policy));
  const exit = pool.find((s) => s.direction === "short" && (positionsUsd[s.asset] ?? 0) > 1);
  if (exit) {
    const size = Math.min(positionsUsd[exit.asset], policy.maxTradeUsd);
    return {
      proposal: toProposal(exit, "sell", size, policy),
      rationale: [`Momentum exit: ${exit.asset} turned short (conviction ${exit.conviction})`, ...exit.rationale],
      citations: exit.citations,
    };
  }
  const entry = pool.filter((s) => s.direction === "long" && s.conviction >= policy.minConviction).sort((a, b) => b.conviction - a.conviction)[0];
  if (entry) {
    return {
      proposal: toProposal(entry, "buy", policy.maxTradeUsd, policy),
      rationale: [`Momentum entry: ${entry.asset} is the strongest long (conviction ${entry.conviction})`, ...entry.rationale],
      citations: entry.citations,
    };
  }
  return { proposal: null, rationale: [`No long signal reached conviction ${policy.minConviction}`, watching(pool)], citations: [] };
}

/** Narrative rotation: only act on moves backed by news evidence; rotate out of held names that turn short. */
function narrativeRotation({ signals, policy, positionsUsd }: Input): StrategyOutput {
  const pool = signals.filter((s) => eligible(s, policy));
  const exit = pool.find((s) => s.direction === "short" && s.citations.length > 0 && (positionsUsd[s.asset] ?? 0) > 1);
  if (exit) {
    return {
      proposal: toProposal(exit, "sell", Math.min(positionsUsd[exit.asset], policy.maxTradeUsd), policy),
      rationale: [`Rotating out of ${exit.asset}: bearish and news-backed`, ...exit.rationale],
      citations: exit.citations,
    };
  }
  const leader = pool
    .filter((s) => s.direction === "long" && s.citations.length > 0 && s.conviction >= policy.minConviction)
    .sort((a, b) => b.conviction - a.conviction)[0];
  if (leader) {
    return {
      proposal: toProposal(leader, "buy", policy.maxTradeUsd, policy),
      rationale: [`Rotating into ${leader.asset}: bullish, news-backed (${leader.citations.length} headlines)`, ...leader.rationale],
      citations: leader.citations,
    };
  }
  return { proposal: null, rationale: [`No news-backed long signal reached conviction ${policy.minConviction}`, watching(pool)], citations: [] };
}

const fmtRsi = (r: AssetRsi) => `RSI 1h ${r["1h"]?.toFixed(0) ?? "-"} · 4h ${r["4h"]?.toFixed(0) ?? "-"} · 24h ${r["24h"]?.toFixed(0) ?? "-"} · 7d ${r["7d"]?.toFixed(0) ?? "-"}`;

/**
 * RSI reversion: buy a short-term oversold dip inside a healthy longer trend, and sell a held position once it is
 * overbought. Uses live RSI only; with no RSI data it does nothing. Conviction is a heuristic ranking from how
 * oversold the 4h reading is, capped at 80.
 */
function rsiReversion({ signals, policy, positionsUsd, rsi }: Input): StrategyOutput {
  if (!rsi || Object.keys(rsi).length === 0) return { proposal: null, rationale: ["RSI data is unavailable right now, so no action was taken"], citations: [] };
  const pool = signals.filter((s) => eligible(s, policy) && rsi[s.asset]);

  const exit = pool.find((s) => (positionsUsd[s.asset] ?? 0) > 1 && (rsi[s.asset]["4h"] ?? 0) >= 70);
  if (exit) {
    return {
      proposal: toProposal(exit, "sell", Math.min(positionsUsd[exit.asset], policy.maxTradeUsd), policy),
      rationale: [`RSI exit: ${exit.asset} is overbought on 4h`, fmtRsi(rsi[exit.asset])],
      citations: exit.citations,
    };
  }

  const dips = pool
    .map((s) => ({ s, r: rsi[s.asset] }))
    // Oversold on both short timeframes, but the weekly trend is not broken.
    .filter(({ r }) => r["1h"] != null && r["4h"] != null && r["1h"] <= 35 && r["4h"] <= 30 && (r["7d"] ?? 0) >= 40)
    .map(({ s, r }) => ({ s, r, conviction: Math.min(80, Math.round(50 + (30 - (r["4h"] as number)) * 2 + ((r["24h"] ?? 50) <= 40 ? 5 : 0))) }))
    .filter(({ conviction }) => conviction >= policy.minConviction)
    .sort((a, b) => b.conviction - a.conviction);
  const best = dips[0];
  if (best) {
    return {
      proposal: { ...toProposal(best.s, "buy", policy.maxTradeUsd, policy), conviction: best.conviction },
      rationale: [`RSI dip buy: ${best.s.asset} is oversold on 1h and 4h while the weekly trend holds`, fmtRsi(best.r)],
      citations: best.s.citations,
    };
  }
  return {
    proposal: null,
    rationale: ["No oversold dip inside a healthy trend and nothing overbought to sell", ...pool.map((s) => `${s.asset} ${fmtPrice(s.price)} · ${fmtRsi(rsi[s.asset])}`)],
    citations: [],
  };
}

export const STRATEGY_FNS: Record<Strategy, (i: Input) => StrategyOutput> = {
  momentum,
  narrative_rotation: narrativeRotation,
  rsi_reversion: rsiReversion,
};
