import { ErrorCard } from "@/components/error-card";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { SourceBadge } from "@/components/source-badge";
import { fmtPct, fmtUsd, tone } from "@/lib/format";
import { getEtfFlows } from "@/lib/intel/sosovalue";
import { buildMarketMindIndex } from "@/lib/intel/ssi";

// Cold starts hit the SoSoValue rate limit (10 req/min), so allow the full Hobby limit.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "Index & ETF" };

export default async function IndicesPage() {
  const [idx, btc, eth] = await Promise.allSettled([buildMarketMindIndex(), getEtfFlows("BTC", 14), getEtfFlows("ETH", 14)]);
  if (idx.status === "rejected" && btc.status === "rejected" && eth.status === "rejected") {
    return <ErrorCard title="Could not load index data" message={idx.reason instanceof Error ? idx.reason.message : "failed"} />;
  }
  const etfs = [
    { label: "BTC spot ETFs", res: btc },
    { label: "ETH spot ETFs", res: eth },
  ];
  return (
    <>
      <PageHeader title="Index & ETF" description="The Orca universe basket, and daily net flows into US spot ETFs." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Orca basket"
          subtitle="Market-cap weighted, single name capped. Computed from live prices; not an on-chain product."
          right={idx.status === "fulfilled" ? <SourceBadge source={idx.value.source} /> : undefined}
        >
          {idx.status === "fulfilled" ? (
            <>
              <p className="mb-3 text-sm">
                24h <span className={`font-mono ${tone(idx.value.change24h)}`}>{fmtPct(idx.value.change24h)}</span>
              </p>
              <table className="w-full text-sm">
                <thead className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <tr><th className="py-2">Asset</th><th>Weight</th><th>Price</th><th>24h</th></tr>
                </thead>
                <tbody>
                  {idx.value.constituents.map((c) => (
                    <tr key={c.symbol} className="border-t">
                      <td className="py-2 font-medium">{c.symbol}</td>
                      <td className="font-mono">{c.targetWeight}%</td>
                      <td className="font-mono">${c.price.toLocaleString()}</td>
                      <td className={`font-mono ${tone(c.change24h)}`}>{fmtPct(c.change24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="font-mono text-xs text-red-400">{idx.reason instanceof Error ? idx.reason.message : "failed"}</p>
          )}
        </Panel>

        {etfs.map(({ label, res }) => (
          <Panel key={label} title={label} subtitle="Daily net inflow, newest first" right={<SourceBadge source="SoSoValue/etf" />}>
            {res.status === "fulfilled" ? (
              <ul className="space-y-1.5 text-sm">
                {[...res.value.data].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((d) => (
                  <li key={d.date} className="flex justify-between border-t pt-1.5 first:border-t-0 first:pt-0">
                    <span className="text-muted-foreground">{d.date}</span>
                    <span className={`font-mono ${tone(d.totalNetInflow)}`}>{d.totalNetInflow >= 0 ? "+" : ""}{fmtUsd(d.totalNetInflow)}</span>
                  </li>
                ))}
                {res.value.data.length === 0 && <li className="text-muted-foreground">No data returned.</li>}
              </ul>
            ) : (
              <p className="font-mono text-xs text-red-400">{res.reason instanceof Error ? res.reason.message : "failed"}</p>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}
