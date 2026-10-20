import { DEFAULT_POLICY } from "./agents/policy";
import { STARTERS } from "./agents/starters";
import { STRATEGY_FNS, type AssetRsi } from "./agents/strategies";
import { memo } from "./cache";
import { CORE_SYMBOLS, TRADABLE } from "./exec/mints";
import { researchSymbols } from "./research";
import { evaluate } from "./risk/engine";
import type { Check, Policy, Proposal, Verdict } from "./risk/types";
import { buildSignals } from "./signals";

export type BotView = {
  name: string;
  strategy: string;
  blurb: string;
  data: string;
  action: "buy" | "sell" | "none";
  proposal: Proposal | null;
  rationale: string[];
  /** What the Risk Engine says about the proposal, when there is one. */
  verdict: Verdict | null;
  checks: Check[];
};

export type BotsSnapshot = { bots: BotView[]; signalsUsed: number; generatedAt: number };

/** The policy the demo bots run under: the same defaults a new user gets, widened to every tradable token. */
const DEMO_POLICY: Policy = { ...DEFAULT_POLICY, mode: "propose", allowedAssets: TRADABLE.map((t) => t.symbol), minConviction: 60, maxTradeUsd: 25 };

/**
 * Runs the three starter strategies on live data and the real Risk Engine, with no account, no database and no
 * money. It is the same code a user's agent runs, shown so visitors can see the bots working before signing up.
 */
export async function buildBotsSnapshot(): Promise<BotsSnapshot> {
  const { signals } = await buildSignals();
  const tokens = await researchSymbols(CORE_SYMBOLS).catch(() => []);
  const rsi: Record<string, AssetRsi> = Object.fromEntries(tokens.map((t) => [t.symbol, { "1h": t.rsi["1h"].value, "4h": t.rsi["4h"].value, "24h": t.rsi["24h"].value, "7d": t.rsi["7d"].value }]));

  const bots = STARTERS.map((s): BotView => {
    const out = STRATEGY_FNS[s.strategy]({ signals, policy: DEMO_POLICY, positionsUsd: {}, rsi });
    const ev = out.proposal ? evaluate(DEMO_POLICY, out.proposal, { now: Date.now(), spentTodayUsd: 0, portfolioValueUsd: 1000, positionUsd: 0, globalKill: false }) : null;
    return { name: s.name, strategy: s.strategy, blurb: s.blurb, data: s.data, action: out.proposal?.side ?? "none", proposal: out.proposal, rationale: out.rationale, verdict: ev?.verdict ?? null, checks: ev?.checks ?? [] };
  });
  return { bots, signalsUsed: signals.length, generatedAt: Date.now() };
}

/** Cached for five minutes so the public page and the landing widget never multiply upstream calls. */
export const getBots = () => memo("bots", 5 * 60_000, buildBotsSnapshot);
