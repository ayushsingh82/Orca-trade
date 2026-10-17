import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { decisions, type Agent, type Decision } from "@/db/schema";
import { GLOBAL_KILL } from "@/lib/exec/config";
import { readPortfolio } from "@/lib/exec/portfolio";
import { executeProposal } from "@/lib/exec/router";
import { loadAgentKeypair } from "@/lib/exec/signer";
import { evaluate } from "@/lib/risk/engine";
import type { Check, Proposal, RiskContext, Verdict } from "@/lib/risk/types";
import { buildSignals } from "@/lib/signals";
import { STRATEGY_FNS } from "./strategies";

const startOfUtcDay = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

async function spentToday(agentId: string) {
  const [row] = await db()
    .select({ total: sql<number>`coalesce(sum(${decisions.executedUsd}), 0)` })
    .from(decisions)
    .where(and(eq(decisions.agentId, agentId), gte(decisions.createdAt, startOfUtcDay())));
  return Number(row?.total ?? 0);
}

async function riskContext(agent: Agent, prices: Record<string, number>, asset?: string) {
  const [portfolio, spent] = await Promise.all([readPortfolio(agent.walletPublicKey, prices), spentToday(agent.id)]);
  const ctx: RiskContext = {
    now: Date.now(),
    spentTodayUsd: spent,
    portfolioValueUsd: portfolio.totalUsd,
    positionUsd: asset ? (portfolio.positionsUsd[asset.toUpperCase()] ?? 0) : 0,
    globalKill: GLOBAL_KILL(),
  };
  return { ctx, portfolio };
}

const priceMap = (signals: { asset: string; price: number }[]) =>
  Object.fromEntries(signals.map((s) => [s.asset, s.price]));

async function carryOut(agent: Agent, proposal: Proposal, price: number) {
  const result = await executeProposal(proposal, loadAgentKeypair(agent.walletSecretEnc), price);
  if (result.kind === "executed") {
    return { status: "executed" as const, executedUsd: proposal.sizeUsd, txSignature: result.signature, error: null };
  }
  // Simulated: nothing moved, so it does not count toward the daily cap.
  return {
    status: result.error ? ("failed" as const) : ("simulated" as const),
    executedUsd: 0,
    txSignature: null,
    error: result.error ? `simulation failed: ${result.error}` : null,
  };
}

/** One agent cycle: signals -> strategy proposal -> Risk Engine -> (log | queue | execute). Always writes a Decision Record. */
export async function runAgent(agent: Agent): Promise<Decision> {
  const { signals, source } = await buildSignals();
  const prices = priceMap(signals);
  const { portfolio } = await riskContext(agent, prices);
  const out = STRATEGY_FNS[agent.strategy]({ signals, policy: agent.policy, positionsUsd: portfolio.positionsUsd });

  let verdict: Verdict = "log_only";
  let checks: Check[] = [];
  let status: Decision["status"] = "logged";
  let executedUsd = 0;
  let txSignature: string | null = null;
  let error: string | null = null;

  if (out.proposal) {
    const { ctx } = await riskContext(agent, prices, out.proposal.asset);
    const ev = evaluate(agent.policy, out.proposal, ctx);
    verdict = ev.verdict;
    checks = ev.checks;
    if (ev.verdict === "reject") status = "rejected";
    else if (ev.verdict === "needs_approval") status = "pending";
    else if (ev.verdict === "allow") {
      try {
        ({ status, executedUsd, txSignature, error } = await carryOut(agent, out.proposal, prices[out.proposal.asset]));
      } catch (e) {
        status = "failed";
        error = e instanceof Error ? e.message : "execution error";
      }
    }
  }

  const [row] = await db()
    .insert(decisions)
    .values({
      agentId: agent.id,
      signalSource: source,
      rationale: out.rationale,
      citations: out.citations,
      proposal: out.proposal,
      verdict,
      checks,
      status,
      executedUsd,
      txSignature,
      error,
    })
    .returning();
  return row;
}

/** Human approval of a queued decision. The Risk Engine re-checks against fresh state before anything runs. */
export async function approveDecision(agent: Agent, decision: Decision): Promise<Decision> {
  if (decision.status !== "pending" || !decision.proposal) throw new Error("decision is not awaiting approval");
  const { signals } = await buildSignals();
  const prices = priceMap(signals);
  const { ctx } = await riskContext(agent, prices, decision.proposal.asset);
  const ev = evaluate(agent.policy, decision.proposal, ctx);

  let patch: Partial<Decision>;
  if (ev.verdict === "reject") {
    patch = { status: "rejected", verdict: "reject", checks: ev.checks, error: "re-check failed at approval time" };
  } else if (ev.verdict === "log_only") {
    throw new Error("agent is in observe mode and cannot execute");
  } else {
    try {
      patch = { ...(await carryOut(agent, decision.proposal, prices[decision.proposal.asset])), checks: ev.checks };
    } catch (e) {
      patch = { status: "failed", error: e instanceof Error ? e.message : "execution error" };
    }
  }
  const [row] = await db().update(decisions).set(patch).where(eq(decisions.id, decision.id)).returning();
  return row;
}
