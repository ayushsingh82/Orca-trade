import Link from "next/link";
import { ErrorCard } from "@/components/error-card";
import { TokenSearch } from "@/components/markets/token-search";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { RsiBadge, ZONE_LABEL, ZONE_STYLE } from "@/components/rsi";
import { fmtAgo, fmtPct, tone } from "@/lib/format";
import { researchAll, TIMEFRAMES } from "@/lib/research";
import type { Zone } from "@/lib/research/rsi";

// Price history is rate limited upstream, so a cold start can take a while.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const metadata = { title: "RSI Research" };

export default async function ResearchPage() {
  const { tokens, errors } = await researchAll();
  if (tokens.length === 0) {
    return <ErrorCard title="Could not load research" message={Object.values(errors)[0] ?? "No data"} />;
  }
  const updated = Math.max(...tokens.map((t) => t.updatedAt));
  return (
    <>
      <PageHeader
        title="RSI Research"
        description="Relative Strength Index across 1h, 4h, 24h and 7d. RSI measures momentum from 0 to 100: above 70 is overbought, below 30 is oversold."
      />
      <SourceBadge className="-mt-4 mb-6" />
      <TokenSearch target="research" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="p-4">Token</th>
              <th className="p-4">Price</th>
              <th className="p-4">24h</th>
              {TIMEFRAMES.map((t) => (
                <th key={t} className="p-4">RSI {t}</th>
              ))}
              <th className="p-4">Read</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.symbol} className="border-t transition-colors hover:bg-muted">
                <td className="p-4">
                  <Link href={`/research/${t.symbol}`} className="font-medium hover:text-accent">
                    {t.symbol} <span className="font-normal text-muted-foreground">{t.name}</span>
                  </Link>
                </td>
                <td className="p-4 font-mono">${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 10 ? 4 : 2 })}</td>
                <td className={`p-4 font-mono ${t.changes["24h"] == null ? "" : tone(t.changes["24h"])}`}>
                  {t.changes["24h"] == null ? "—" : fmtPct(t.changes["24h"])}
                </td>
                {TIMEFRAMES.map((tf) => (
                  <td key={tf} className="p-4">
                    <RsiBadge value={t.rsi[tf].value} zone={t.rsi[tf].zone} />
                  </td>
                ))}
                <td className="p-4 text-xs text-muted-foreground">{t.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Object.keys(errors).length > 0 && (
        <p className="mt-3 text-xs text-amber-400">Could not load: {Object.keys(errors).join(", ")}. Refresh in a minute.</p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
          <span key={z} className={`rounded-md border px-2 py-0.5 ${ZONE_STYLE[z]}`}>{ZONE_LABEL[z]}</span>
        ))}
        <span>· 14-period RSI · updated {fmtAgo(updated)}</span>
      </div>
      <p className="mt-4 max-w-2xl text-xs text-muted-foreground">
        Agreement across timeframes matters more than any one reading. A low 1h RSI inside a strong 7d RSI is a pullback in an uptrend; a high reading on every timeframe is stretched. RSI describes momentum, not direction, and it is not a trade signal on its own.
      </p>
    </>
  );
}
