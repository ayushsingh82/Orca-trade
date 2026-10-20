import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SourceBadge } from "@/components/source-badge";
import { ErrorCard } from "@/components/error-card";
import { PageHeader } from "@/components/page-header";
import { Panel, PulseRail } from "@/components/panel";
import { fmtAgo, fmtPct, fmtPrice, tone } from "@/lib/format";
import { buildLiveNewsImpacts, detectContradictions } from "@/lib/intel/marketmind";
import { getKlines, getSectorSpotlight } from "@/lib/intel/sosovalue";
import { LineChart } from "@/components/line-chart";
import { SentimentView } from "@/components/live/sentiment-view";
import { getSentiment } from "@/lib/sentiment";
import { buildSignals } from "@/lib/signals";
import { cn } from "@/lib/utils";

// Cold starts hit the SoSoValue rate limit (10 req/min), so allow the full Hobby limit.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DIRECTION_STYLE = {
  long: "text-emerald-400",
  short: "text-red-400",
  neutral: "text-muted-foreground",
} as const;

export default async function DashboardPage() {
  let data;
  try {
    data = await buildSignals();
  } catch (e) {
    return <ErrorCard title="Could not load live signals" message={e instanceof Error ? e.message : "Unknown error"} />;
  }
  const { signals, source } = data;
  // Same calls buildSignals already made, so these are cache hits; sectors is one extra request.
  const [news, contra, sectors, sentiment] = await Promise.allSettled([buildLiveNewsImpacts(10), detectContradictions(), getSectorSpotlight(), getSentiment()]);
  const contradictions = contra.status === "fulfilled" ? contra.value.items : [];
  const headlines = news.status === "fulfilled" ? news.value.items.slice(0, 6) : [];
  const movers = sectors.status === "fulfilled" ? [...sectors.value.data].sort((a, b) => b.change24h - a.change24h) : [];
  // Daily closes are cached 6h and already fetched by buildSignals. Rebased to 100 so assets compare.
  const COLORS = ["#a78bfa", "#34d399", "#fbbf24", "#f87171", "#60a5fa"];
  const rebased = (
    await Promise.all(
      signals.map(async (sig, i) => {
        try {
          const closes = (await getKlines(sig.asset, "1d", 30)).data.sort((a, b) => a.t - b.t).map((k) => k.c);
          return closes.length > 1 ? { name: sig.asset, color: COLORS[i % COLORS.length], values: closes.map((c) => (c / closes[0]) * 100) } : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter((x) => x != null);
  const top = [...signals].sort((a, b) => b.conviction - a.conviction)[0];
  const longs = signals.filter((s) => s.direction === "long").length;
  const shorts = signals.filter((s) => s.direction === "short").length;
  const breadth = signals.length ? signals.filter((s) => s.change24h > 0).length : 0;
  return (
    <>
      <PageHeader
        title="Intelligence Board"
        description="What is worth attention right now, with the evidence and the disagreements."
      />
      <SourceBadge source={source} className="-mt-4 mb-6" />
      <PulseRail
        items={[
          { label: "Assets tracked", value: String(signals.length), hint: `${breadth} up in 24h` },
          { label: "Top conviction", value: top ? `${top.asset} ${top.conviction}` : "—", hint: top?.direction, tone: top?.direction === "long" ? "good" : top?.direction === "short" ? "bad" : "default" },
          { label: "Long / short", value: `${longs} / ${shorts}`, hint: "signals by direction" },
          { label: "Contradictions", value: String(contradictions.length), hint: "cross-source disagreement", tone: contradictions.length > 2 ? "warn" : "default" },
          { label: "Headlines", value: String(headlines.length), hint: "with measured impact" },
          { label: "Updated", value: fmtAgo(data.generatedAt), hint: "cached up to a few minutes" },
        ]}
      />
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Opportunities</h2>
        <Link href="/markets" className="text-xs text-accent underline">All markets →</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {signals.slice(0, 12).map((s) => (
          <Link key={s.id} href={`/signals/${s.asset}`} className="block rounded-xl border bg-card p-5 transition-colors hover:bg-muted">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{s.asset}</h2>
              <span className={cn("text-xs font-medium uppercase", DIRECTION_STYLE[s.direction])}>
                {s.direction}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {fmtPrice(s.price)} · {s.change24h >= 0 ? "+" : ""}
              {s.change24h}%
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {s.rationale.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${s.conviction}%` }} />
              </div>
              <span className="font-mono text-xs text-muted-foreground">{s.conviction}</span>
            </div>
            {s.contradictions.length > 0 && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {s.contradictions[0].title}
              </p>
            )}
          </Link>
        ))}
      </div>
      {sentiment.status === "fulfilled" && (
        <Panel title="Market sentiment" subtitle="One reading from breadth, news, sectors and order flow" right={<Link href="/sentiment" className="text-xs text-accent underline">Details</Link>} className="mt-6">
          <SentimentView s={sentiment.value} compact />
        </Panel>
      )}
      <Panel title="Cross-asset, last 30 days" subtitle="Daily closes rebased to 100 at the start" className="mt-6">
        <LineChart series={rebased} labels={["30d ago", "today"]} />
      </Panel>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Contradictions" subtitle="Where sources disagree. Agents act more cautiously here.">
          <ul className="space-y-3">
            {contradictions.slice(0, 4).map((c) => (
              <li key={c.id} className="text-sm">
                <p className="flex items-center gap-2">
                  <span className={c.severity === "high" ? "text-red-400" : c.severity === "medium" ? "text-amber-400" : "text-muted-foreground"}>{c.severity}</span>
                  <span className="font-medium">{c.title}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.signalA.label} {c.signalA.value} vs {c.signalB.label} {c.signalB.value}</p>
              </li>
            ))}
            {contradictions.length === 0 && <li className="text-sm text-muted-foreground">No contradictions detected right now.</li>}
          </ul>
        </Panel>
        <Panel title="Sector movers" subtitle="24h change">
          <ul className="space-y-1.5 text-sm">
            {[...movers.slice(0, 3), ...movers.slice(-3)].map((m) => (
              <li key={m.sector} className="flex justify-between border-t pt-1.5 first:border-t-0 first:pt-0">
                <span>{m.sector}</span>
                <span className={`font-mono ${tone(m.change24h)}`}>{fmtPct(m.change24h)}</span>
              </li>
            ))}
            {movers.length === 0 && <li className="text-muted-foreground">Sector data unavailable.</li>}
          </ul>
        </Panel>
      </div>
      <Panel title="Headline impact" subtitle="Latest news and the measured price reaction" className="mt-6">
        <div className="-mx-1 flex gap-3 overflow-x-auto pb-1">
          {headlines.map((n) => (
            <article key={n.id} className="min-w-[260px] max-w-[300px] shrink-0 rounded-lg border bg-muted p-3">
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span>{n.classification}</span>
                {n.measured !== false && <span className={tone(n.priceImpactPct)}>{fmtPct(n.priceImpactPct)}</span>}
              </div>
              <p className="mt-2 line-clamp-3 text-sm">{n.title}</p>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">{n.symbols.join(" · ")} · {fmtAgo(n.publishedAt)}</p>
            </article>
          ))}
          {headlines.length === 0 && <p className="text-sm text-muted-foreground">No headlines returned right now.</p>}
        </div>
      </Panel>
    </>
  );
}
