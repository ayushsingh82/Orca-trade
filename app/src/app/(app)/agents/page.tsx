import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agents, decisions } from "@/db/schema";
import { ActionButton } from "@/components/agents/action-button";
import { ToggleButton } from "@/components/agents/toggle-button";
import { CreateAgentForm } from "@/components/agents/create-agent-form";
import { FundAgent } from "@/components/agents/fund-agent";
import { StarterAgents } from "@/components/agents/starter-agents";
import { FundFromOrcaWallet } from "@/components/agents/fund-from-orca-wallet";
import { VaultSetup } from "@/components/agents/vault-setup";
import { squadsAddresses } from "@/lib/exec/squads";
import { PublicKey } from "@solana/web3.js";
import { SolanaProviders } from "@/components/agents/wallet-provider";
import { PageHeader } from "@/components/page-header";
import { getUser } from "@/lib/auth/session";
import { EXECUTION_ENABLED } from "@/lib/exec/config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  executed: "text-emerald-400",
  paper: "text-emerald-400",
  simulated: "text-sky-400",
  pending: "text-amber-400",
  rejected: "text-red-400",
  failed: "text-red-400",
  logged: "text-muted-foreground",
};

export default async function AgentsPage() {
  const user = await getUser();
  if (!user) {
    return (
      <>
        <PageHeader title="Agents" description="Sign in to create and run agents." />
        <Link href="/login" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          Sign in
        </Link>
      </>
    );
  }

  const mine = await db().select().from(agents).where(eq(agents.userId, user.id)).orderBy(desc(agents.createdAt));
  const recent = mine.length
    ? await db().select().from(decisions).where(inArray(decisions.agentId, mine.map((a) => a.id))).orderBy(desc(decisions.createdAt)).limit(50)
    : [];

  return (
    <SolanaProviders>
      <PageHeader title="Agents" description="Agents propose; the Risk Engine decides. Every run leaves a Decision Record." />
      <p className="-mt-4 mb-6 text-xs text-muted-foreground">
        Execution: {EXECUTION_ENABLED ? "live on Solana mainnet" : "quote + simulate only (EXECUTION_ENABLED is off)"}
      </p>
      <StarterAgents existing={mine.map((a) => a.name)} />
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <CreateAgentForm />
        <div className="space-y-6">
          {mine.length === 0 && <p className="text-sm text-muted-foreground">No agents yet. Create one to get started.</p>}
          {mine.map((a) => (
            <section key={a.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">{a.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {a.strategy.replace("_", " ")} · {a.paper ? "paper" : "live"} · {a.policy.mode} · ${a.policy.maxTradeUsd}/trade · ${a.policy.maxDailyUsd}/day
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Leaderboard is switched off for the MVP.
                  {a.paper && (
                    <ToggleButton url={`/api/agents/${a.id}/list`} field="listed" on={a.listed} labelOn="Listed on leaderboard · unlist" labelOff="List on leaderboard" />
                  )}
                  */}
                  <ActionButton url={`/api/agents/${a.id}/run`} label="Run now" busyLabel="Running…" />
                </div>
              </div>
              {!a.paper && (
                <>
                  <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">Agent wallet: {a.walletPublicKey}</p>
                  {process.env.NEXT_PUBLIC_PRIVY_APP_ID && user.wallet && <FundFromOrcaWallet fromAddress={user.wallet} agentAddress={a.walletPublicKey} />}
                  <FundAgent address={a.walletPublicKey} />
                  <VaultSetup
                    agentId={a.id}
                    linked={
                      a.squadsMultisig && a.squadsDailyUsdc
                        ? { vault: squadsAddresses(new PublicKey(a.squadsMultisig)).vault.toBase58(), dailyUsdc: a.squadsDailyUsdc }
                        : null
                    }
                  />
                </>
              )}

              <h3 className="mt-5 text-xs uppercase tracking-wide text-muted-foreground">Decision log</h3>
              <ul className="mt-2 divide-y">
                {recent.filter((d) => d.agentId === a.id).slice(0, 8).map((d) => (
                  <li key={d.id} className="space-y-1 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-xs font-medium uppercase", STATUS_STYLE[d.status])}>{d.status}</span>
                      <span>
                        {d.proposal ? `${d.proposal.side} ${d.proposal.asset} $${d.proposal.sizeUsd}` : "No action"}
                        {d.fillPrice ? ` @ $${d.fillPrice.toFixed(2)}` : ""}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{d.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                      <ToggleButton url={`/api/decisions/${d.id}/share`} field="shared" on={d.shared} labelOn="Shared · unshare" labelOff="Share" />
                      {d.status === "pending" && <ActionButton url={`/api/decisions/${d.id}/approve`} label="Approve" busyLabel="Executing…" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{d.rationale[0]}</p>
                    {d.checks.filter((c) => !c.passed).map((c) => (
                      <p key={c.rule} className="text-xs text-red-400">
                        ✗ {c.rule}: {c.detail}
                      </p>
                    ))}
                    {d.error && <p className="text-xs text-red-400">{d.error}</p>}
                    {d.txSignature && <p className="break-all font-mono text-[11px] text-muted-foreground">tx {d.txSignature}</p>}
                  </li>
                ))}
                {!recent.some((d) => d.agentId === a.id) && <li className="py-3 text-xs text-muted-foreground">No runs yet.</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </SolanaProviders>
  );
}
