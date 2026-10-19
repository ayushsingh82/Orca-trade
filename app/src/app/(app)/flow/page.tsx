import { ErrorCard } from "@/components/error-card";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { fmtUsd } from "@/lib/format";
import { getOrderFlow, type OrderFlow } from "@/lib/intel/orderflow";

export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const metadata = { title: "Order Flow" };

const SYMBOLS = ["BTC", "ETH", "SOL"];

export default async function FlowPage() {
  const results = await Promise.all(
    SYMBOLS.map(async (symbol) => {
      try {
        return { symbol, flow: await getOrderFlow(symbol), error: null as string | null };
      } catch (e) {
        return { symbol, flow: null as OrderFlow | null, error: e instanceof Error ? e.message : "failed" };
      }
    }),
  );
  if (results.every((r) => r.error)) {
    return <ErrorCard title="Could not load order flow" message={results[0].error ?? "failed"} />;
  }
  return (
    <>
      <PageHeader title="Order Flow" description="Order book and taker flow from the last 100 trades. Shows who is lifting offers and who is hitting bids." />
      <SourceBadge className="-mt-4 mb-6" />
      <div className="grid gap-4 md:grid-cols-3">
        {results.map(({ symbol, flow, error }) => (
          <section key={symbol} className="rounded-xl border bg-card p-5">
            <h2 className="font-display text-xl font-semibold">{symbol}</h2>
            {error || !flow ? (
              <p className="mt-2 font-mono text-xs text-red-400">{error}</p>
            ) : (
              <>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row k="Spread" v={`${flow.spreadBps} bps`} />
                  <Row k="Depth imbalance" v={`${flow.depthImbalance > 0 ? "+" : ""}${flow.depthImbalance}`} hint={flow.depthImbalance > 0.1 ? "bids heavier" : flow.depthImbalance < -0.1 ? "offers heavier" : "balanced"} />
                  <Row k="Taker buy share" v={`${(flow.takerBuyRatio * 100).toFixed(1)}%`} hint={`last ${flow.trades} trades`} />
                  <Row k="Net taker flow" v={`${flow.netFlowUsd >= 0 ? "+" : ""}${fmtUsd(flow.netFlowUsd)}`} />
                </dl>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-accent" style={{ width: `${flow.takerBuyRatio * 100}%` }} />
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
