export type Series = { name: string; color: string; values: number[] };

/** Dependency-free SVG line chart. Every series is plotted on one shared y-axis. */
export function LineChart({ series, labels, height = 220 }: { series: Series[]; labels: [string, string]; height?: number }) {
  const w = 600;
  const pad = { l: 36, r: 8, t: 8, b: 20 };
  const all = series.flatMap((s) => s.values);
  if (all.length < 2) return <p className="text-sm text-muted-foreground">Not enough data to chart.</p>;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const x = (i: number, n: number) => pad.l + (i / Math.max(n - 1, 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / span) * (height - pad.t - pad.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
              {t.toFixed(0)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth="1.75"
            points={s.values.map((v, i) => `${x(i, s.values.length)},${y(v)}`).join(" ")}
          />
        ))}
        <text x={pad.l} y={height - 4} fontSize="10" fill="var(--muted-foreground)">{labels[0]}</text>
        <text x={w - pad.r} y={height - 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{labels[1]}</text>
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
