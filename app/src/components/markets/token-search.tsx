"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtPrice } from "@/lib/format";

type Hit = { id: string; symbol: string; name: string; image: string | null; rank: number | null; price: number; change24h: number | null; tradable: boolean; risk: string | null };

/** Search every coin CoinGecko lists. Debounced, with the latest request winning so slow responses cannot overwrite newer ones. */
export function TokenSearch() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ term: string; hits: Hit[]; error: string | null }>({ term: "", hits: [], error: null });
  const seq = useRef(0);
  const term = q.trim();
  const active = term.length >= 2;
  // Loading is derived: we are waiting whenever the latest result is not for the text currently typed.
  const loading = active && result.term !== term;
  const hits = active ? result.hits : [];
  const msg = !active ? null : loading ? null : result.error ?? (result.hits.length === 0 ? "No tokens found" : null);

  useEffect(() => {
    if (term.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (mine !== seq.current) return; // a newer search is already running
        if (!json.ok) throw new Error(json.error);
        setResult({ term, hits: json.results, error: null });
      } catch (e) {
        if (mine !== seq.current) return;
        setResult({ term, hits: [], error: e instanceof Error ? e.message : "Search failed" });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [term]);

  return (
    <div className="relative mb-5 max-w-xl">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any token by name or symbol (BONK, render, dogwifhat…)"
        aria-label="Search tokens"
        className="w-full rounded-lg border bg-card px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      {active && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-card shadow-xl shadow-black/40">
          {loading && hits.length === 0 && <p className="p-3 text-xs text-muted-foreground">Searching…</p>}
          {msg && <p className={`p-3 text-xs ${result.error ? "text-red-400" : "text-muted-foreground"}`}>{msg}</p>}
          <ul>
            {hits.map((h) => (
              <li key={h.id}>
                <Link href={`/markets/${h.id}`} onClick={() => setQ("")} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {h.image ? <img src={h.image} alt="" width={20} height={20} className="size-5 rounded-full" /> : <span className="size-5 rounded-full bg-muted" />}
                  <span className="font-medium">{h.symbol}</span>
                  <span className="truncate text-muted-foreground">{h.name}</span>
                  {h.rank && <span className="font-mono text-[10px] text-muted-foreground">#{h.rank}</span>}
                  {h.tradable && <span className="rounded border border-emerald-400/30 px-1.5 font-mono text-[9px] uppercase text-emerald-300">tradable</span>}
                  <span className="ml-auto font-mono text-xs">{fmtPrice(h.price)}</span>
                  {h.change24h != null && <span className={`font-mono text-xs ${h.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>{h.change24h >= 0 ? "+" : ""}{h.change24h.toFixed(1)}%</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
