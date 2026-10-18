import { ErrorCard } from "@/components/error-card";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { fmtUsd } from "@/lib/format";
import { takerBuyStats, toSodexPair } from "@/lib/intel/analytics";
import { getOrderbook, getRecentTrades } from "@/lib/intel/sodex";

export const dynamic = "force-dynamic";
export const metadata = { title: "SoDEX Flow" };

const SYMBOLS = ["BTC", "ETH", "SOL"];

export default async function FlowPage() {
  const results = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      const pair = toSodexPair(symbol);
      try {
        const [ob, tr] = await Promise.all([getOrderbook(pair), getRecentTrades(pair, 60)]);
        if (!ob.data.bids.length && !ob.data.asks.length && !tr.data.length) {
          return { symbol, ob: null, stats: null, count: 0, error: "SoDEX returned an empty order book and no recent trades" };
        }
        return { symbol, ob: ob.data, stats: takerBuyStats(tr.data), count: tr.data.length, error: null };
      } catch (e) {
        return { symbol, ob: null, stats: null, count: 0, error: e instanceof Error ? e.message : "failed" };
      }
    }),
  );
  if (results.every((r) => r.error)) {
    return <ErrorCard title="Could not load SoDEX" message={results[0].error ?? "failed"} />;
  }
  return (
    <>
      <PageHeader title="SoDEX Flow" description="Order book and taker flow from recent trades. Shows who is lifting offers and who is hitting bids." />
      <SourceBadge source="SoDEX spot" className="-mt-4 mb-6" />
      <div className="grid gap-4 md:grid-cols-3">
        {results.map((r) => (
          <section key={r.symbol} className="rounded-xl border bg-card p-5">
            <h2 className="font-display text-xl font-semibold">{r.symbol}</h2>
            {r.error || !r.ob || !r.stats ? (
              <p className="mt-2 font-mono text-xs text-red-400">{r.error}</p>
            ) : (
              <>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row k="Spread" v={`${r.ob.spreadBps} bps`} />
                  <Row k="Depth imbalance" v={`${r.ob.depthImbalance > 0 ? "+" : ""}${r.ob.depthImbalance}`} hint={r.ob.depthImbalance > 0.1 ? "bids heavier" : r.ob.depthImbalance < -0.1 ? "offers heavier" : "balanced"} />
                  <Row k="Taker buy share" v={`${(r.stats.takerBuyRatio * 100).toFixed(1)}%`} hint={`last ${r.count} trades`} />
                  <Row k="Net taker flow" v={fmtUsd(r.stats.netFlow)} />
                </dl>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-accent" style={{ width: `${r.stats.takerBuyRatio * 100}%` }} />
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function Row({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono">
        {v}
        {hint && <span className="ml-2 text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}
