import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentTransfers, agents, decisions, type Agent, type Decision } from "@/db/schema";
import { WithdrawButton } from "@/components/agents/withdraw-button";
import { ErrorCard } from "@/components/error-card";
import { LineChart } from "@/components/line-chart";
import { PageHeader } from "@/components/page-header";
import { AllocationBar } from "@/components/portfolio/allocation-bar";
import { Panel, PulseRail } from "@/components/panel";
import { TelegramForm } from "@/components/telegram-form";
import { getUser } from "@/lib/auth/session";
import { readPortfolio, type Portfolio } from "@/lib/exec/portfolio";
import { readWalletBalances } from "@/lib/exec/wallet";
import { fmtAgo, fmtPct, tone } from "@/lib/format";
import { allocation, analyzeFills, type PortfolioStats } from "@/lib/portfolio/analytics";
import { buildSignals } from "@/lib/signals";
import { cn } from "@/lib/utils";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolio" };

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const units = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 6 : 4 });
const scan = (sig: string) => `https://solscan.io/tx/${sig}`;
const STATUS_STYLE: Record<string, string> = { executed: "text-emerald-400", paper: "text-emerald-400", simulated: "text-sky-400", pending: "text-amber-400", rejected: "text-red-400", failed: "text-red-400", logged: "text-muted-foreground" };

type PaperRow = { kind: "paper"; agent: Agent; stats: PortfolioStats; fills: Decision[] };
type LiveRow = { kind: "live"; agent: Agent; book: Portfolio | null; error: string | null; fills: Decision[] };

export default async function PortfolioPage() {
  const user = await getUser();
  if (!user) {
    return (
      <>
        <PageHeader title="Portfolio" description="Sign in to see your agents' positions and PnL." />
        <Link href="/login" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          Sign in
        </Link>
      </>
    );
  }

  let rows: (PaperRow | LiveRow)[];
  let pending: Decision[];
  let moves: (typeof agentTransfers.$inferSelect)[];
  let wallet: { sol: number; usdc: number } | null = null;
  let prices: Record<string, number>;
  try {
    const mine = await db().select().from(agents).where(eq(agents.userId, user.id)).orderBy(desc(agents.createdAt));
    const ids = mine.map((a) => a.id);
    const all = ids.length ? await db().select().from(decisions).where(inArray(decisions.agentId, ids)).orderBy(desc(decisions.createdAt)).limit(1000) : [];
    moves = await db().select().from(agentTransfers).where(eq(agentTransfers.userId, user.id)).orderBy(desc(agentTransfers.createdAt)).limit(50);
    pending = all.filter((d) => d.status === "pending");
    const { signals } = await buildSignals();
    prices = Object.fromEntries(signals.map((s) => [s.asset, s.price]));
    if (user.wallet) wallet = await readWalletBalances(user.wallet).catch(() => null);

    rows = await Promise.all(
      mine.map(async (agent): Promise<PaperRow | LiveRow> => {
        const mineFills = all.filter((d) => d.agentId === agent.id);
        if (agent.paper) {
          const fills = mineFills.filter((d) => d.status === "paper" && d.proposal && d.fillUnits != null && d.fillPrice != null);
          const stats = analyzeFills(
            agent.paperStartUsd,
            fills.map((d) => ({ at: d.createdAt.getTime(), asset: d.proposal!.asset.toUpperCase(), units: d.fillUnits!, price: d.fillPrice! })),
            prices,
          );
          return { kind: "paper", agent, stats, fills };
        }
        try {
          // Wallet only. The risk view also counts vault capital, which is not the agent's money yet.
          return { kind: "live", agent, book: await readPortfolio(agent.walletPublicKey, prices), error: null, fills: mineFills };
        } catch (e) {
          return { kind: "live", agent, book: null, error: e instanceof Error ? e.message : "could not read wallet", fills: mineFills };
        }
      }),
    );
  } catch (e) {
    return <ErrorCard title="Could not load portfolio" message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  const paper = rows.filter((r): r is PaperRow => r.kind === "paper");
  const live = rows.filter((r): r is LiveRow => r.kind === "live");
  const paperValue = paper.reduce((s, r) => s + r.stats.equityUsd, 0);
  const paperStart = paper.reduce((s, r) => s + r.agent.paperStartUsd, 0);
  const paperPnl = paperValue - paperStart;
  const realized = paper.reduce((s, r) => s + r.stats.realizedUsd, 0);
  const unrealized = paper.reduce((s, r) => s + r.stats.unrealizedUsd, 0);
  const liveValue = live.reduce((s, r) => s + (r.book?.totalUsd ?? 0), 0);
  const trades = paper.reduce((s, r) => s + r.stats.trades, 0);
  const closed = paper.reduce((s, r) => s + r.stats.closedTrades, 0);
  const wins = paper.reduce((s, r) => s + r.stats.wins, 0);
  const walletUsd = wallet ? wallet.usdc + wallet.sol * (prices.SOL ?? 0) : 0;
  const totalValue = paperValue + liveValue + walletUsd;

  // Everything in one allocation: wallet, live agents, paper agents.
  const slices: Record<string, number> = {};
  const add = (label: string, v: number) => (slices[label] = (slices[label] ?? 0) + v);
  if (wallet) {
    add("Cash (USDC)", wallet.usdc);
    add("SOL", wallet.sol * (prices.SOL ?? 0));
  }
  for (const r of live) {
    if (!r.book) continue;
    add("Cash (USDC)", r.book.usdc);
    for (const [a, v] of Object.entries(r.book.positionsUsd)) add(a, v);
  }
  for (const r of paper) {
    add("Cash (USDC)", r.stats.cashUsd);
    for (const p of r.stats.positions) add(p.asset, p.value);
  }
  const alloc = allocation(Object.entries(slices).map(([label, value]) => ({ label, value })));

  return (
    <>
      <PageHeader title="Portfolio" description="Everything in one place: your wallet, your live agents and your paper agents, marked to live prices." />

      {pending.length > 0 && (
        <Link href="/agents" className="mb-6 flex items-center justify-between rounded-xl border border-amber-400/40 bg-card p-4 text-sm hover:bg-muted">
          <span className="text-amber-400">
            {pending.length} trade{pending.length > 1 ? "s" : ""} waiting for your approval
          </span>
          <span className="text-muted-foreground">Review →</span>
        </Link>
      )}

      <PulseRail
        items={[
          { label: "Total value", value: usd(totalValue), hint: "wallet + agents" },
          { label: "Paper PnL", value: paper.length ? signed(paperPnl) : "—", hint: paper.length ? fmtPct(paperStart ? (paperPnl / paperStart) * 100 : 0) : "no paper agents", tone: paperPnl > 0 ? "good" : paperPnl < 0 ? "bad" : "default" },
          { label: "Realized", value: paper.length ? signed(realized) : "—", hint: `${closed} closed trade${closed === 1 ? "" : "s"}`, tone: realized > 0 ? "good" : realized < 0 ? "bad" : "default" },
          { label: "Unrealized", value: paper.length ? signed(unrealized) : "—", hint: "open positions", tone: unrealized > 0 ? "good" : unrealized < 0 ? "bad" : "default" },
          { label: "Win rate", value: closed ? `${((wins / closed) * 100).toFixed(0)}%` : "—", hint: `${trades} paper trade${trades === 1 ? "" : "s"}` },
          { label: "Live agents", value: usd(liveValue), hint: `${live.length} agent${live.length === 1 ? "" : "s"}` },
        ]}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel
          title="Your wallet"
          subtitle={user.wallet ? `${user.wallet.slice(0, 6)}…${user.wallet.slice(-6)}` : "No wallet yet"}
          right={
            <Link href="/wallet" className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">
              {user.wallet ? "Add funds" : "Get a wallet"}
            </Link>
          }
        >
          {wallet ? (
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">USDC</dt>
                <dd className="mt-1 font-display text-xl font-semibold">{wallet.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
              </div>
              <div className="rounded-lg border bg-muted p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">SOL</dt>
                <dd className="mt-1 font-display text-xl font-semibold">{wallet.sol.toLocaleString(undefined, { maximumFractionDigits: 4 })}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{user.wallet ? "Could not read the balance right now." : "Sign in with email or Google and we create a Solana wallet for you."}</p>
          )}
        </Panel>
        <Panel title="Allocation" subtitle="Cash and positions across the wallet and every agent">
          <AllocationBar slices={alloc} />
        </Panel>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No agents yet. <Link href="/agents" className="text-accent underline">Start with a live agent</Link>.
        </p>
      )}

      <div className="space-y-4">
        {paper.map(({ agent, stats, fills }) => (
          <section key={agent.id} className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">{agent.name}</h2>
                <p className="text-xs text-muted-foreground">
                  paper · {agent.strategy.replace("_", " ")} · {agent.policy.mode}
                  {agent.policy.killSwitch && <span className="ml-2 text-red-400">paused</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold">{usd(stats.equityUsd)}</p>
                <p className={cn("font-mono text-xs", tone(stats.pnlUsd))}>
                  {signed(stats.pnlUsd)} ({fmtPct(stats.pnlPct)}) since the {usd(agent.paperStartUsd)} start
                </p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
              {[
                ["Cash", usd(stats.cashUsd)],
                ["Realized", signed(stats.realizedUsd)],
                ["Unrealized", signed(stats.unrealizedUsd)],
                ["Trades", `${stats.trades}`],
                ["Win rate", stats.winRate == null ? "—" : `${stats.winRate.toFixed(0)}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-muted px-3 py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 font-mono text-sm">{v}</dd>
                </div>
              ))}
            </dl>

            {stats.curve.length > 2 && (
              <div className="mt-4">
                <LineChart series={[{ name: "Equity", color: "#9085fb", values: stats.curve }, { name: "Start", color: "#6b7280", values: stats.curve.map(() => agent.paperStartUsd) }]} labels={["start", "now"]} height={140} />
              </div>
            )}

            {stats.positions.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <tr>
                      <th className="py-2">Asset</th>
                      <th>Units</th>
                      <th>Avg entry</th>
                      <th>Value</th>
                      <th>Unrealized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.positions.map((p) => (
                      <tr key={p.asset} className="border-t">
                        <td className="py-2 font-medium">{p.asset}</td>
                        <td className="font-mono">{units(p.units)}</td>
                        <td className="font-mono">{usd(p.avgCost)}</td>
                        <td className="font-mono">{usd(p.value)}</td>
                        <td className={cn("font-mono", tone(p.unrealizedUsd))}>
                          {signed(p.unrealizedUsd)} ({fmtPct(p.unrealizedPct)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {stats.positions.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{stats.trades ? "No open positions." : "No trades yet. Observe-mode agents report setups without trading."}</p>}

            <Fills fills={fills.slice(0, 5)} />
          </section>
        ))}

        {live.map(({ agent, book, error, fills }) => (
          <section key={agent.id} className="rounded-xl border border-accent/40 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">{agent.name}</h2>
                <p className="text-xs text-muted-foreground">
                  live · {agent.strategy.replace("_", " ")} · {agent.policy.mode} · ${agent.policy.maxTradeUsd}/trade · ${agent.policy.maxDailyUsd}/day
                  {agent.policy.killSwitch && <span className="ml-2 text-red-400">paused</span>}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {agent.walletPublicKey} ·{" "}
                  <a className="text-accent underline" href={`https://solscan.io/account/${agent.walletPublicKey}`} target="_blank" rel="noreferrer">
                    Solscan
                  </a>
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold">{book ? usd(book.totalUsd) : "—"}</p>
                <p className="text-xs text-muted-foreground">in the agent wallet</p>
              </div>
            </div>
            {error && <p className="mt-3 text-xs text-amber-400">Could not read this wallet right now.</p>}
            {book && (
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                <li className="rounded-lg bg-muted px-3 py-2">
                  <span className="text-muted-foreground">USDC</span> {usd(book.usdc)}
                </li>
                <li className="rounded-lg bg-muted px-3 py-2">
                  <span className="text-muted-foreground">SOL for fees</span> {units(book.sol)}
                </li>
                {Object.entries(book.positionsUsd)
                  .filter(([a, v]) => a !== "SOL" && Math.abs(v) > 0.005)
                  .map(([a, v]) => (
                    <li key={a} className="rounded-lg bg-muted px-3 py-2">
                      <span className="text-muted-foreground">{a}</span> {usd(v)}
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-start gap-2">
              <Link href="/agents" className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">
                Fund or set the cap
              </Link>
              <WithdrawButton agentId={agent.id} agentName={agent.name} destination={user.wallet} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Profit and loss for live agents is not tracked yet. Compare the value here with what you sent in.</p>
            <Fills fills={fills.filter((d) => d.proposal).slice(0, 5)} />
          </section>
        ))}
      </div>

      {moves.length > 0 && (
        <Panel title="Withdrawals" subtitle="Money moved from an agent back to your wallet" className="mt-6">
          <ul className="divide-y text-sm">
            {moves.slice(0, 10).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {m.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {m.asset.length > 8 ? `${m.asset.slice(0, 4)}…` : m.asset}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {fmtAgo(m.createdAt.getTime())} ·{" "}
                  <a className="text-accent underline" href={scan(m.signature)} target="_blank" rel="noreferrer">
                    view
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <a href="/api/portfolio/export" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
          Download history (CSV)
        </a>
        <p className="text-xs text-muted-foreground">Paper results are simulated at real quoted prices. Not financial advice.</p>
      </div>
      <TelegramForm />
    </>
  );
}

function Fills({ fills }: { fills: Decision[] }) {
  if (fills.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Recent activity</h3>
      <ul className="mt-1 divide-y text-sm">
        {fills.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="flex items-center gap-2">
              <span className={cn("text-xs font-medium uppercase", STATUS_STYLE[d.status])}>{d.status}</span>
              {d.proposal ? `${d.proposal.side} ${d.proposal.asset} $${d.proposal.sizeUsd}` : "No action"}
              {d.fillPrice != null && <span className="font-mono text-xs text-muted-foreground">@ {usd(d.fillPrice)}</span>}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {fmtAgo(d.createdAt.getTime())}
              {d.txSignature && (
                <>
                  {" · "}
                  <a className="text-accent underline" href={scan(d.txSignature)} target="_blank" rel="noreferrer">
                    tx
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
