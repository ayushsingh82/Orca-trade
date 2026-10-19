"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/markets/sparkline";
import { WatchStar } from "@/components/markets/watch-star";
import type { MarketRow } from "@/lib/tokens/markets";
import { cn } from "@/lib/utils";

type SortKey = "rank" | "price" | "change1h" | "change24h" | "change7d" | "marketCap" | "volume24h";
const RISK_STYLE = { core: "border-emerald-400/30 text-emerald-300", standard: "border-sky-400/30 text-sky-300", high: "border-amber-400/40 text-amber-300" } as const;

const fmtPrice = (p: number) => `$${p.toLocaleString(undefined, { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 4 : 8 })}`;
const fmtBig = (n: number | null) => (n == null ? "—" : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`);

function Pct({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("font-mono", v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-muted-foreground")}>{`${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}</span>;
}

/** Sortable, filterable token table. Sorting and filtering happen in the browser on the rows already loaded. */
export function MarketsTable({ rows, watched, loggedIn }: { rows: MarketRow[]; watched: string[]; loggedIn: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [filter, setFilter] = useState("");
  const [hideStables, setHideStables] = useState(true);
  const [onlyTradable, setOnlyTradable] = useState(false);
  const watchedSet = useMemo(() => new Set(watched), [watched]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = rows.filter((r) => (!hideStables || !r.isStable) && (!onlyTradable || r.tradable) && (!q || r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)));
    const val = (r: MarketRow) => (sort.key === "rank" ? (r.rank ?? 1e9) : (r[sort.key] ?? -Infinity));
    return [...list].sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [rows, filter, hideStables, onlyTradable, sort]);

  const head = (label: string, key: SortKey, right = true) => (
    <th className={cn("p-3", right && "text-right")}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "rank" ? 1 : -1 }))} className="font-mono text-[10px] uppercase tracking-[0.15em] hover:text-foreground">
        {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter this list…" aria-label="Filter this list" className="w-56 rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input type="checkbox" checked={hideStables} onChange={(e) => setHideStables(e.target.checked)} /> Hide stablecoins
        </label>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input type="checkbox" checked={onlyTradable} onChange={(e) => setOnlyTradable(e.target.checked)} /> Agent-tradable only
        </label>
        <span className="ml-auto text-muted-foreground">{shown.length} shown</span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="w-8 p-3" />
              {head("#", "rank", false)}
              <th className="p-3 font-mono text-[10px] uppercase tracking-[0.15em]">Token</th>
              {head("Price", "price")}
              {head("1h", "change1h")}
              {head("24h", "change24h")}
              {head("7d", "change7d")}
              {head("Market cap", "marketCap")}
              {head("Volume", "volume24h")}
              <th className="p-3 text-right font-mono text-[10px] uppercase tracking-[0.15em]">7d</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t transition-colors hover:bg-muted">
                <td className="p-3">
                  <WatchStar id={r.id} symbol={r.symbol} name={r.name} initial={watchedSet.has(r.id)} loggedIn={loggedIn} />
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{r.rank ?? "—"}</td>
                <td className="p-3">
                  <Link href={`/markets/${r.id}`} className="flex items-center gap-2.5 hover:text-accent">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image ? <img src={r.image} alt="" width={22} height={22} className="size-[22px] rounded-full" /> : <span className="size-[22px] rounded-full bg-muted" />}
                    <span className="font-medium">{r.symbol}</span>
                    <span className="hidden text-muted-foreground sm:inline">{r.name}</span>
                    {r.tradable && <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase", RISK_STYLE[r.tradable.risk])}>{r.tradable.risk === "high" ? "tradable · high risk" : "tradable"}</span>}
                  </Link>
                </td>
                <td className="p-3 text-right font-mono">{fmtPrice(r.price)}</td>
                <td className="p-3 text-right"><Pct v={r.change1h} /></td>
                <td className="p-3 text-right"><Pct v={r.change24h} /></td>
                <td className="p-3 text-right"><Pct v={r.change7d} /></td>
                <td className="p-3 text-right font-mono text-xs">{fmtBig(r.marketCap)}</td>
                <td className="p-3 text-right font-mono text-xs">{fmtBig(r.volume24h)}</td>
                <td className="p-3 text-right"><Sparkline values={r.sparkline} /></td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">Nothing matches. Try clearing the filters, or search all tokens above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
