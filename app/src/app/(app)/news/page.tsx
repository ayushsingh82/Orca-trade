import { ErrorCard } from "@/components/error-card";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { fmtAgo, fmtPct, tone } from "@/lib/format";
import { buildLiveNewsImpacts } from "@/lib/intel/marketmind";

export const dynamic = "force-dynamic";
export const metadata = { title: "News Impact" };

export default async function NewsPage() {
  let res;
  try {
    res = await buildLiveNewsImpacts(10);
  } catch (e) {
    return <ErrorCard title="Could not load news" message={e instanceof Error ? e.message : "Unknown error"} />;
  }
  return (
    <>
      <PageHeader title="News Impact" description="Headlines with the price reaction measured after publication, and how fast it decays." />
      <SourceBadge source={res.source} className="-mt-4 mb-6" />
      <div className="grid gap-4 lg:grid-cols-2">
        {res.items.map((n) => (
          <article key={n.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span>{n.classification} · {n.source}</span>
              <span>{fmtAgo(n.publishedAt)}</span>
            </div>
            <h2 className="mt-2 text-sm font-medium">{n.title}</h2>
            {n.aiSummary && <p className="mt-2 text-xs text-muted-foreground">{n.aiSummary}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className={n.sentiment === "bullish" ? "text-emerald-400" : n.sentiment === "bearish" ? "text-red-400" : "text-muted-foreground"}>
                {n.sentiment}
              </span>
              {n.measured === false ? (
                <span className="text-muted-foreground">price reaction not measured</span>
              ) : (
                <>
                  <span className={`font-mono ${tone(n.priceImpactPct)}`}>{fmtPct(n.priceImpactPct)} in {n.reactionWindowMin}m</span>
                  <span className="font-mono text-muted-foreground">half-life {n.decayHalfLifeMin}m</span>
                </>
              )}
              <span className="ml-auto font-mono text-muted-foreground">{n.symbols.join(" · ")}</span>
            </div>
          </article>
        ))}
        {res.items.length === 0 && <p className="text-sm text-muted-foreground">No headlines returned right now.</p>}
      </div>
    </>
  );
}
