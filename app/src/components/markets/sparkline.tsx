/** A tiny price line. Green when the period ended higher than it started, red when lower. */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - lo) / span) * (height - 4)).toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={up ? "Trending up" : "Trending down"}>
      <polyline points={pts} fill="none" stroke={up ? "#34d399" : "#f87171"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
