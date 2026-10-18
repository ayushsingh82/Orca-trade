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
