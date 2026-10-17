import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { TelegramForm } from "@/components/telegram-form";
import { PageHeader } from "@/components/page-header";
import { ErrorCard } from "@/components/error-card";
import { getBook } from "@/lib/agents/runner";
import { getUser } from "@/lib/auth/session";
import { buildSignals } from "@/lib/signals";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

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

  let rows;
  try {
    const mine = await db().select().from(agents).where(eq(agents.userId, user.id)).orderBy(desc(agents.createdAt));
    const { signals } = await buildSignals();
    const prices = Object.fromEntries(signals.map((s) => [s.asset, s.price]));
    rows = await Promise.all(mine.map(async (a) => ({ agent: a, book: await getBook(a, prices) })));
  } catch (e) {
    return <ErrorCard title="Could not load portfolio" message={e instanceof Error ? e.message : "Unknown error"} />;
  }

  const total = rows.reduce((s, r) => s + r.book.totalUsd, 0);
  const pnl = rows.reduce((s, r) => s + (r.agent.paper && "pnlUsd" in r.book ? Number((r.book as { pnlUsd: number }).pnlUsd) : 0), 0);

  return (
    <>
      <PageHeader title="Portfolio" description="Value, positions and PnL per agent, marked to live prices." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total value</p>
          <p className="mt-1 font-display text-3xl font-semibold">{usd(total)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Paper PnL</p>
          <p className={cn("mt-1 font-display text-3xl font-semibold", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>{usd(pnl)}</p>
        </div>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No agents yet. Create one on the Agents page.</p>}
      <div className="space-y-4">
        {rows.map(({ agent, book }) => (
          <section key={agent.id} className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">{agent.name}</h2>
              <span className="font-mono text-xs text-muted-foreground">{agent.paper ? "paper" : "live"} · {usd(book.totalUsd)}</span>
            </div>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              {Object.entries(book.positionsUsd)
                .filter(([, v]) => Math.abs(v) > 0.005)
                .map(([asset, v]) => (
                  <li key={asset} className="rounded-lg bg-muted px-3 py-2">
                    <span className="text-muted-foreground">{asset}</span> {usd(v)}
                  </li>
                ))}
              {"cashUsd" in book && (
                <li className="rounded-lg bg-muted px-3 py-2">
                  <span className="text-muted-foreground">Cash</span> {usd(Number((book as { cashUsd: number }).cashUsd))}
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
      <TelegramForm />
    </>
  );
}
