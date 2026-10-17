import type { Check, Evaluation, Policy, Proposal, RiskContext, RiskFlag } from "./types";

const RANK: Record<RiskFlag, number> = { none: 0, low: 1, medium: 2, high: 3 };
const FLAGS: RiskFlag[] = ["none", "low", "medium", "high"];

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Parses untrusted output (e.g. from an LLM) into a Proposal, or returns null.
 * Anything missing, mistyped, non-finite or non-positive is rejected, never coerced.
 */
export function parseProposal(raw: unknown): Proposal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.asset !== "string" || !r.asset.trim()) return null;
  if (r.side !== "buy" && r.side !== "sell") return null;
  if (!isNum(r.sizeUsd) || r.sizeUsd <= 0) return null;
  if (!isNum(r.maxSlippageBps) || r.maxSlippageBps < 0) return null;
  if (!isNum(r.conviction) || r.conviction < 0 || r.conviction > 100) return null;
  if (typeof r.riskFlag !== "string" || !FLAGS.includes(r.riskFlag as RiskFlag)) return null;
  return {
    asset: r.asset.trim().toUpperCase(),
    side: r.side,
    sizeUsd: r.sizeUsd,
    maxSlippageBps: r.maxSlippageBps,
    conviction: r.conviction,
    riskFlag: r.riskFlag as RiskFlag,
  };
}

/**
 * The only gate between a proposal and execution. Pure and deterministic: no I/O, no LLM.
 * Every hard rule must pass; then the agent's mode (and contradiction risk) decide the verdict.
 */
export function evaluate(policy: Policy, proposal: Proposal, ctx: RiskContext): Evaluation {
  const checks: Check[] = [];
  const check = (rule: string, passed: boolean, detail: string) => checks.push({ rule, passed, detail });

  check("kill_switch", !(ctx.globalKill || policy.killSwitch), ctx.globalKill ? "platform kill switch on" : policy.killSwitch ? "agent kill switch on" : "off");

  const expired = policy.expiresAt !== null && ctx.now >= policy.expiresAt;
  check("policy_expiry", !expired, expired ? "policy expired" : "policy active");

  const allowed = policy.allowedAssets.map((a) => a.toUpperCase());
  const assetOk = allowed.includes(proposal.asset.toUpperCase());
  check("asset_allowed", assetOk, assetOk ? `${proposal.asset} is allowed` : `${proposal.asset} not in allowed assets`);

  const sizeOk = isNum(proposal.sizeUsd) && proposal.sizeUsd > 0 && proposal.sizeUsd <= policy.maxTradeUsd;
  check("max_trade", sizeOk, `size $${proposal.sizeUsd} vs cap $${policy.maxTradeUsd}`);

  const dailyOk = isNum(ctx.spentTodayUsd) && ctx.spentTodayUsd + proposal.sizeUsd <= policy.maxDailyUsd;
  check("max_daily", dailyOk, `spent $${ctx.spentTodayUsd} + $${proposal.sizeUsd} vs cap $${policy.maxDailyUsd}`);

  const slipOk = isNum(proposal.maxSlippageBps) && proposal.maxSlippageBps <= policy.maxSlippageBps;
  check("max_slippage", slipOk, `${proposal.maxSlippageBps}bps vs cap ${policy.maxSlippageBps}bps`);

  const convOk = isNum(proposal.conviction) && proposal.conviction >= policy.minConviction;
  check("min_conviction", convOk, `${proposal.conviction} vs min ${policy.minConviction}`);

  if (proposal.side === "buy") {
    const base = ctx.portfolioValueUsd;
    const after = ctx.positionUsd + proposal.sizeUsd;
    const pct = base > 0 ? (after / base) * 100 : Infinity;
    check("concentration", pct <= policy.maxPositionPct, `position would be ${Number.isFinite(pct) ? pct.toFixed(1) : "n/a"}% vs cap ${policy.maxPositionPct}%`);
  } else {
    const ok = proposal.sizeUsd <= ctx.positionUsd;
    check("sell_within_position", ok, `sell $${proposal.sizeUsd} vs position $${ctx.positionUsd}`);
  }

  const flag = RANK[proposal.riskFlag] ?? RANK.high;
  const rejectAt = policy.rejectAtRisk ? RANK[policy.rejectAtRisk] : null;
  const contraReject = rejectAt !== null && flag >= rejectAt;
  check("contradiction_reject", !contraReject, `risk flag ${proposal.riskFlag}`);

  if (checks.some((c) => !c.passed)) return { verdict: "reject", checks };

  const downgrade = flag >= RANK[policy.downgradeAtRisk];
  check("contradiction_downgrade", !downgrade, downgrade ? `risk ${proposal.riskFlag}: needs human approval` : "no downgrade");

  if (policy.mode === "observe") return { verdict: "log_only", checks };
  if (policy.mode === "propose" || downgrade) return { verdict: "needs_approval", checks };
  return { verdict: "allow", checks };
}
