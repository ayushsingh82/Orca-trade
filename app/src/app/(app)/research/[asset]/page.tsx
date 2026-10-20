import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ErrorCard } from "@/components/error-card";
import { LineChart } from "@/components/line-chart";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { ZONE_LABEL, RsiBadge, RsiGauge } from "@/components/rsi";
import { SourceBadge } from "@/components/source-badge";
import { fmtPct, tone } from "@/lib/format";
import { researchCoin, researchToken, TIMEFRAMES } from "@/lib/research";
import { RESEARCH_ASSETS } from "@/lib/research/prices";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TF_NOTE = {
  "1h": "Short-term momentum. Swings quickly; useful for timing.",
  "4h": "Intraday trend. Filters most hourly noise.",
  "24h": "Daily momentum. The standard reading most traders quote.",
  "7d": "Weekly momentum. Slow; shows the larger trend.",
} as const;

export default async function ResearchAssetPage({ params, searchParams }: PageProps<"/research/[asset]">) {
  const { asset } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 80);
  const known = RESEARCH_ASSETS.find((a) => a.symbol === asset.toUpperCase());
  // Any other coin is addressed by its CoinGecko id (from the search box), with its symbol and name in the query.
  if (!known && !/^[a-z0-9-]{1,80}$/.test(asset)) notFound();
  const symbol = known ? known.symbol : (one(sp.s) ?? asset).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || asset.toUpperCase();

  let t;
  try {
    t = known ? await researchToken(symbol) : await researchCoin({ id: asset, symbol, name: one(sp.n) ?? symbol });
  } catch (e) {
    return <ErrorCard title={`Could not load ${symbol}`} message={e instanceof Error ? e.message : "failed"} />;
  }
  const changes = [
    ["1h", t.changes["1h"]],
    ["24h", t.changes["24h"]],
    ["7d", t.changes["7d"]],
    ["30d", t.changes["30d"]],
  ] as const;
  return (
    <>
      <Link href="/research" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All tokens
      </Link>
      <PageHeader
        title={`${t.name} (${t.symbol})`}
        description={`$${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 10 ? 4 : 2 })} · ${t.summary}`}
      />
      <SourceBadge className="-mt-4 mb-6" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIMEFRAMES.map((tf) => {
          const r = t.rsi[tf];
          return (
            <section key={tf} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">RSI {tf}</h2>
                <RsiBadge value={r.value} zone={r.zone} />
              </div>
              {r.value != null && r.zone ? (
                <>
                  <div className="my-4">
                    <RsiGauge value={r.value} />
                  </div>
                  <p className="text-sm">{ZONE_LABEL[r.zone]}</p>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Not enough history.</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{TF_NOTE[tf]}</p>
            </section>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Price change" subtitle="Move over each window">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {changes.map(([label, v]) => (
              <div key={label} className="rounded-lg border bg-muted p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
                <dd className={`mt-1 font-mono text-lg ${v == null ? "" : tone(v)}`}>{v == null ? "—" : fmtPct(v)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Where it sits in its 1-year range" subtitle={`Low $${t.low365d.toLocaleString(undefined, { maximumFractionDigits: 2 })} · High $${t.high365d.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}>
          <div className="relative mt-3 h-2 rounded-full bg-muted">
            <div className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-background bg-accent" style={{ left: `${t.rangePosition365d}%` }} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {t.rangePosition365d.toFixed(0)}% of the way from the 1-year low to the 1-year high.
          </p>
        </Panel>
      </div>

      <Panel title="1h RSI, last 7 days" subtitle="Hourly readings. Crossing 70 or 30 marks stretched momentum." className="mt-6">
        <LineChart series={[{ name: "RSI 1h", color: "#a78bfa", values: t.rsi1hHistory }, { name: "70 overbought", color: "#f87171", values: t.rsi1hHistory.map(() => 70) }, { name: "30 oversold", color: "#34d399", values: t.rsi1hHistory.map(() => 30) }]} labels={["7d ago", "now"]} fixedRange={[0, 100]} />
      </Panel>
    </>
  );
}
