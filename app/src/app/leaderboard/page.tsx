import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { BrandLogo } from "@/components/brand";
import { ErrorCard } from "@/components/error-card";
import { getBook } from "@/lib/agents/runner";
import { buildSignals } from "@/lib/signals";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Public leaderboard of opt-in paper agents, ranked by return since their virtual $1,000 start. */
export default async function Leaderboard() {
  let rows;
  try {
    const listed = await db().select().from(agents).where(eq(agents.listed, true));
    const { signals } = await buildSignals();
    const prices = Object.fromEntries(signals.map((s) => [s.asset, s.price]));
    rows = (
      await Promise.all(
        listed.map(async (a) => {
          const book = await getBook(a, prices);
          return { id: a.id, name: a.name, strategy: a.strategy, returnPct: ((book.totalUsd - a.paperStartUsd) / a.paperStartUsd) * 100 };
        }),
      )
    ).sort((x, y) => y.returnPct - x.returnPct);
  } catch (e) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <ErrorCard title="Could not load leaderboard" message={e instanceof Error ? e.message : "Unknown error"} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 md:py-12">
      <BrandLogo />
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Paper agents that opted in, ranked by return on a virtual $1,000 at real quoted prices.</p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agents have been listed yet.</p>
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-4 px-5 py-3">
              <span className="w-6 font-mono text-sm text-muted-foreground">{i + 1}</span>
              <span className="flex-1">
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{r.strategy.replace("_", " ")}</span>
              </span>
              <span className={cn("font-mono text-sm", r.returnPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                {r.returnPct >= 0 ? "+" : ""}
                {r.returnPct.toFixed(2)}%
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">Paper results are simulated and not financial advice.</p>
    </div>
  );
}
