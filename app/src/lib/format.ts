export function fmtPct(n: number, places = 2) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(places)}%`;
}

export function fmtUsd(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function fmtAgo(ts: number, now = Date.now()) {
  const m = Math.max(0, Math.round((now - ts) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export const tone = (n: number) => (n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-muted-foreground");

/** Display-safe label for a data source: provider names are not shown in the UI. */
export function sourceLabel(s: string) {
  return s
    .replace(/SoSoValue\s*\/?\s*news/gi, "news feed")
    .replace(/SoSoValue\s*\/?\s*sectors?/gi, "sector data")
    .replace(/SoSoValue\s*\/?\s*macro/gi, "macro calendar")
    .replace(/SoDEX\s*(taker|trades|flow)?/gi, "order flow")
    .replace(/SoSoValue|CoinGecko|Jupiter/gi, "market data");
}

/** A USD price that stays readable from $82,000 down to $0.0000029 (never rounds a small price to $0). */
export function fmtPrice(p: number): string {
  const a = Math.abs(p);
  if (!Number.isFinite(p)) return "—";
  if (a === 0) return "$0";
  if (a >= 100) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (a >= 1) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
  if (a >= 0.01) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  // Keep three significant digits however many zeros follow the decimal point.
  const decimals = Math.min(12, 2 - Math.floor(Math.log10(a)));
  return `$${p.toFixed(decimals)}`;
}
