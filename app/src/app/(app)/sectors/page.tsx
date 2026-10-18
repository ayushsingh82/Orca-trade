import { ErrorCard } from "@/components/error-card";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { fmtPct, fmtUsd, tone } from "@/lib/format";
import { getSectorSpotlight } from "@/lib/intel/sosovalue";

// Cold starts hit the SoSoValue rate limit (10 req/min), so allow the full Hobby limit.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "Sectors" };

export default async function SectorsPage() {
  let rows;
  try {
    rows = (await getSectorSpotlight()).data;
  } catch (e) {
    return <ErrorCard title="Could not load sectors" message={e instanceof Error ? e.message : "Unknown error"} />;
  }
  rows = [...rows].sort((a, b) => b.change24h - a.change24h);
  const up = rows.filter((r) => r.change24h > 0).length;
  return (
    <>
      <PageHeader title="Sectors" description="Where the market is rotating. Breadth shows whether a move is broad or narrow." />
      <SourceBadge className="-mt-4 mb-6" />
      <p className="mb-4 text-sm text-muted-foreground">
        {up} of {rows.length} sectors up in the last 24h.
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="p-4">Sector</th>
              <th className="p-4">24h</th>
              <th className="p-4">Market cap</th>
              <th className="p-4">Top gainer</th>
              <th className="p-4">Top loser</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sector} className="border-t">
                <td className="p-4 font-medium">{r.sector}</td>
                <td className={`p-4 font-mono ${tone(r.change24h)}`}>{fmtPct(r.change24h)}</td>
                <td className="p-4 font-mono text-muted-foreground">{r.marketCap ? fmtUsd(r.marketCap) : "—"}</td>
                <td className="p-4 font-mono text-xs">
                  {r.topGainer ? `${r.topGainer} ${r.topGainerChange != null ? fmtPct(r.topGainerChange) : ""}` : "—"}
                </td>
                <td className="p-4 font-mono text-xs">
                  {r.topLoser ? `${r.topLoser} ${r.topLoserChange != null ? fmtPct(r.topLoserChange) : ""}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
