import { cn } from "@/lib/utils";
import type { Zone } from "@/lib/research/rsi";

export const ZONE_STYLE: Record<Zone, string> = {
  oversold: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30",
  weak: "text-emerald-200/80 bg-muted border-border",
  neutral: "text-muted-foreground bg-muted border-border",
  strong: "text-amber-200/80 bg-muted border-border",
  overbought: "text-red-300 bg-red-400/10 border-red-400/30",
};

export const ZONE_LABEL: Record<Zone, string> = {
  oversold: "Oversold",
  weak: "Weak",
  neutral: "Neutral",
  strong: "Strong",
  overbought: "Overbought",
};

export function RsiBadge({ value, zone }: { value: number | null; zone: Zone | null }) {
  if (value == null || !zone) return <span className="font-mono text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-block rounded-md border px-2 py-0.5 font-mono text-xs", ZONE_STYLE[zone])}>{value.toFixed(1)}</span>
  );
}

/** A 0-100 bar with the 30 and 70 thresholds marked and the reading as a dot. */
export function RsiGauge({ value }: { value: number }) {
  return (
    <div className="relative h-2 rounded-full bg-muted">
      <div className="absolute inset-y-0 left-0 w-[30%] rounded-l-full bg-emerald-400/20" />
      <div className="absolute inset-y-0 right-0 w-[30%] rounded-r-full bg-red-400/20" />
      <div className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-background bg-accent" style={{ left: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
