import { Connection, PublicKey } from "@solana/web3.js";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, decisions, users, type Agent, type Decision } from "@/db/schema";
import { sendAlert } from "@/lib/alerts";
import { EXECUTION_ENABLED, GLOBAL_KILL, PILOT_MAX_TRADE_USD, RPC_URL } from "@/lib/exec/config";
import { paperFill, paperPortfolio } from "@/lib/exec/paper";
import { resolveReferencePrice } from "@/lib/exec/reference";
import { readPortfolio } from "@/lib/exec/portfolio";
import { executeProposal } from "@/lib/exec/router";
import { loadAgentKeypair } from "@/lib/exec/signer";
import { pullFromVault, vaultAvailableUsdc, type VaultLink } from "@/lib/exec/vault";
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

export type Book = { totalUsd: number; positionsUsd: Record<string, number> };

/** The agent's current book: its paper ledger, or its real on-chain wallet. */
export async function getBook(agent: Agent, prices: Record<string, number>): Promise<Book> {
  if (agent.paper) {
    const fills = await db().select().from(decisions).where(eq(decisions.agentId, agent.id)).orderBy(asc(decisions.createdAt));
    return paperPortfolio(agent.paperStartUsd, fills, prices);
  }
  const book = await readPortfolio(agent.walletPublicKey, prices);
  // With a vault, the agent's capital also includes what it may still draw today (capped on chain).
  const link = vaultLink(agent);
  if (link) book.totalUsd += await vaultAvailableUsdc(new Connection(RPC_URL, "confirmed"), link, new PublicKey(agent.walletPublicKey));
  return book;
}

async function riskContext(agent: Agent, book: Book, asset?: string): Promise<RiskContext> {
  return {
    now: Date.now(),
    spentTodayUsd: await spentToday(agent.id),
    portfolioValueUsd: book.totalUsd,
    positionUsd: asset ? (book.positionsUsd[asset.toUpperCase()] ?? 0) : 0,
    globalKill: GLOBAL_KILL(),
  };
}

/** Live agents are additionally clamped by the platform pilot cap, regardless of what their own policy says. */
function effectivePolicy(agent: Agent) {
  if (agent.paper || PILOT_MAX_TRADE_USD <= 0) return agent.policy;
  const maxTradeUsd = Math.min(agent.policy.maxTradeUsd, PILOT_MAX_TRADE_USD);
  return { ...agent.policy, maxTradeUsd, maxDailyUsd: Math.min(agent.policy.maxDailyUsd, PILOT_MAX_TRADE_USD * 4) };
}

const priceMap = (signals: { asset: string; price: number }[]) =>
  Object.fromEntries(signals.map((s) => [s.asset, s.price]));

type Outcome = Pick<Decision, "status" | "executedUsd" | "txSignature" | "error" | "fillUnits" | "fillPrice">;

export function vaultLink(agent: Agent): VaultLink | null {
  if (!agent.squadsOwner || !agent.squadsMultisig || !agent.squadsLimit || !agent.squadsDailyUsdc) return null;
  return { owner: agent.squadsOwner, multisig: agent.squadsMultisig, limit: agent.squadsLimit, dailyUsdc: agent.squadsDailyUsdc };
}

async function carryOut(agent: Agent, proposal: Proposal, primaryPrice: number): Promise<Outcome> {
  // Cross-check the SoSoValue price against CoinGecko. Live agents require the second source to be up.
  const price = await resolveReferencePrice(proposal.asset, primaryPrice, { requireSecond: !agent.paper });
  if (agent.paper) {
    const fill = await paperFill(proposal, price);
    return { status: "paper", executedUsd: proposal.sizeUsd, txSignature: null, error: null, fillUnits: fill.units, fillPrice: fill.price };
  }
  const signer = loadAgentKeypair(agent.walletSecretEnc);
  // With a vault linked, the agent is funded just-in-time from it, so the on-chain daily limit is the most it can ever hold.
  const link = vaultLink(agent);
  if (link && proposal.side === "buy") {
    await pullFromVault({ connection: new Connection(RPC_URL, "confirmed"), agent: signer, link, neededUsdc: proposal.sizeUsd, send: EXECUTION_ENABLED });
  }
  const result = await executeProposal(proposal, signer, price);
  if (result.kind === "executed") {
    return { status: "executed", executedUsd: proposal.sizeUsd, txSignature: result.signature, error: null, fillUnits: null, fillPrice: null };
  }
  // Simulated only: nothing moved, so it does not count toward the daily cap.
  return {
    status: result.error ? "failed" : "simulated",
    executedUsd: 0,
    txSignature: null,
    error: result.error ? `simulation failed: ${result.error}` : null,
    fillUnits: null,
    fillPrice: null,
  };
}

async function alert(agent: Agent, d: Decision) {
  if (d.status === "logged") return;
  const [owner] = await db().select({ chat: users.telegramChatId }).from(users).where(eq(users.id, agent.userId)).limit(1);
  const what = d.proposal ? `${d.proposal.side} ${d.proposal.asset} $${d.proposal.sizeUsd}` : "no action";
  const extra = d.status === "pending" ? " — awaiting your approval in Orca" : d.error ? ` — ${d.error}` : d.txSignature ? ` — tx ${d.txSignature}` : "";
  await sendAlert(owner?.chat, `Orca · ${agent.name}: ${d.status.toUpperCase()} · ${what}${extra}`);
}

/** One agent cycle: signals -> strategy proposal -> Risk Engine -> (log | queue | execute). Always writes a Decision Record. */
export async function runAgent(agent: Agent): Promise<Decision> {
  const { signals, source } = await buildSignals();
  const prices = priceMap(signals);
  const book = await getBook(agent, prices);
  const out = STRATEGY_FNS[agent.strategy]({ signals, policy: effectivePolicy(agent), positionsUsd: book.positionsUsd });

  let verdict: Verdict = "log_only";
  let checks: Check[] = [];
  let outcome: Outcome = { status: "logged", executedUsd: 0, txSignature: null, error: null, fillUnits: null, fillPrice: null };

  if (out.proposal) {
    const ev = evaluate(effectivePolicy(agent), out.proposal, await riskContext(agent, book, out.proposal.asset));
    verdict = ev.verdict;
    checks = ev.checks;
    if (ev.verdict === "reject") outcome.status = "rejected";
    else if (ev.verdict === "needs_approval") outcome.status = "pending";
    else if (ev.verdict === "allow") {
      try {
        outcome = await carryOut(agent, out.proposal, prices[out.proposal.asset]);
      } catch (e) {
        outcome = { ...outcome, status: "failed", error: e instanceof Error ? e.message : "execution error" };
      }
    }
  }

  const [row] = await db()
    .insert(decisions)
    .values({ agentId: agent.id, signalSource: source, rationale: out.rationale, citations: out.citations, proposal: out.proposal, verdict, checks, ...outcome })
    .returning();
  await alert(agent, row);
  return row;
}

/** Human approval of a queued decision. The Risk Engine re-checks against fresh state before anything runs. */
export async function approveDecision(agent: Agent, decision: Decision): Promise<Decision> {
  if (decision.status !== "pending" || !decision.proposal) throw new Error("decision is not awaiting approval");
  const { signals } = await buildSignals();
  const prices = priceMap(signals);
  const book = await getBook(agent, prices);
  const ev = evaluate(effectivePolicy(agent), decision.proposal, await riskContext(agent, book, decision.proposal.asset));

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
  await alert(agent, row);
  return row;
}

/** Scheduled sweep: runs every agent once. One failing agent never stops the rest. */
export async function runAllAgents() {
  if (GLOBAL_KILL()) return { ran: 0, failed: 0, skipped: "global kill switch on" as const };
  const all = await db().select().from(agents);
  let ran = 0;
  let failed = 0;
  for (const agent of all) {
    if (agent.policy.killSwitch) continue;
    try {
      await runAgent(agent);
      ran++;
    } catch {
      failed++;
    }
  }
  return { ran, failed, skipped: null };
}
