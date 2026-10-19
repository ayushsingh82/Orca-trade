import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LineChart } from "@/components/line-chart";
import { Panel } from "@/components/panel";
import { RsiBadge, RsiGauge, ZONE_LABEL } from "@/components/rsi";
import { SourceBadge } from "@/components/source-badge";
import { fmtPct, tone } from "@/lib/format";
import { researchCoin, TIMEFRAMES, type TokenResearch } from "@/lib/research";
import { getMarketsByIds } from "@/lib/tokens/markets";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const fmtPrice = (p: number) => `$${p.toLocaleString(undefined, { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 4 : 8 })}`;
const fmtBig = (n: number | null) => (n == null ? "—" : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`);
const TF_NOTE = { "1h": "Short-term momentum.", "4h": "Intraday trend.", "24h": "Daily momentum, the standard reading.", "7d": "Weekly momentum, the larger trend." } as const;

export async function generateMetadata({ params }: PageProps<"/markets/[id]">) {
  return { title: (await params).id };
}

export default async function TokenPage({ params }: PageProps<"/markets/[id]">) {
  const { id } = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)) notFound();
  const [row] = await getMarketsByIds([id]).catch(() => []);
  if (!row) notFound();

  // RSI needs two longer price-history calls, so a failure shows a note instead of breaking the page.
  let research: TokenResearch | null = null;
  try {
    research = await researchCoin({ id: row.id, symbol: row.symbol, name: row.name });
  } catch {
    research = null;
  }

  const changes: [string, number | null][] = [["1h", row.change1h], ["24h", row.change24h], ["7d", row.change7d], ["14d", row.change14d], ["30d", row.change30d]];
  const t = row.tradable;

  return (
    <>
      <Link href="/markets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All markets
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {row.image && <img src={row.image} alt="" width={44} height={44} className="size-11 rounded-full" />}
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-tight">
              {row.name} <span className="text-xl text-muted-foreground">{row.symbol}</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">{row.rank ? `Rank #${row.rank}` : "Unranked"}{row.isStable ? " · stablecoin" : ""}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold">{fmtPrice(row.price)}</p>
          <p className={`font-mono text-sm ${row.change24h == null ? "" : tone(row.change24h)}`}>{row.change24h == null ? "—" : `${fmtPct(row.change24h)} 24h`}</p>
        </div>
      </header>
      <SourceBadge className="mb-6" />

      <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel title="Price, last 7 days" subtitle="Hourly">
          {row.sparkline.length > 2 ? <LineChart series={[{ name: row.symbol, color: row.sparkline[row.sparkline.length - 1] >= row.sparkline[0] ? "#34d399" : "#f87171", values: row.sparkline }]} labels={["7d ago", "now"]} height={200} /> : <p className="text-sm text-muted-foreground">No chart data.</p>}
        </Panel>
        <Panel title="Market">
          <dl className="space-y-2 text-sm">
            {[
              ["Market cap", fmtBig(row.marketCap)],
              ["24h volume", fmtBig(row.volume24h)],
              ["All-time high", row.ath ? fmtPrice(row.ath) : "—"],
              ["From all-time high", row.athChangePct == null ? "—" : fmtPct(row.athChangePct, 1)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Price change" className="mb-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {changes.map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-muted p-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{k}</dt>
              <dd className={`mt-1 font-mono text-lg ${v == null ? "" : tone(v)}`}>{v == null ? "—" : fmtPct(v)}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <h2 className="mb-3 font-display text-lg font-semibold">
        RSI <span className="ml-2 text-sm font-normal text-muted-foreground">{research?.summary}</span>
      </h2>
      {research ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TIMEFRAMES.map((tf) => {
            const r = research.rsi[tf];
            return (
              <section key={tf} className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">RSI {tf}</h3>
                  <RsiBadge value={r.value} zone={r.zone} />
                </div>
                {r.value != null && r.zone ? (
                  <>
                    <div className="my-4"><RsiGauge value={r.value} /></div>
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
      ) : (
        <p className="mb-6 text-sm text-amber-400">RSI is unavailable right now (the price-history provider is busy). Refresh in a minute.</p>
      )}

      <Panel title={t ? "Agents can trade this token" : "View-only token"}>
        {t ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Orca agents can trade {row.symbol} through Jupiter on Solana, from a reviewed list with enough on-chain liquidity. Turn it on per agent under <Link href="/agents" className="text-accent underline">Agents</Link>: it is off unless you select it.
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              Mint {t.mint} ·{" "}
              <a className="text-accent underline" href={`https://solscan.io/token/${t.mint}`} target="_blank" rel="noreferrer">Solscan</a>
            </p>
            {t.risk === "high" && <p className="rounded-lg border border-amber-400/40 bg-muted p-3 text-xs text-amber-300">High risk: memecoins can lose most of their value quickly and can move more than your slippage limit between a quote and a fill. Use small sizes.</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {row.symbol} is shown for research only. Agents trade a short reviewed list of Solana tokens so a wrong or fake contract address can never be traded. {row.isStable ? "Stablecoins are never trading targets." : ""}
          </p>
        )}
      </Panel>
    </>
  );
}
