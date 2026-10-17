import type { OrcaSignal } from "@/lib/signals";
import { isTradable } from "@/lib/exec/mints";
import type { Policy, Proposal } from "@/lib/risk/types";
import type { Strategy } from "@/db/schema";

export type StrategyOutput = { proposal: Proposal | null; rationale: string[]; citations: OrcaSignal["citations"] };

type Input = { signals: OrcaSignal[]; policy: Policy; positionsUsd: Record<string, number> };

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
  return { proposal: null, rationale: ["No eligible signal met the conviction threshold"], citations: [] };
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
  return { proposal: null, rationale: ["No news-backed signal met the conviction threshold"], citations: [] };
}

export const STRATEGY_FNS: Record<Strategy, (i: Input) => StrategyOutput> = {
  momentum,
  narrative_rotation: narrativeRotation,
};
