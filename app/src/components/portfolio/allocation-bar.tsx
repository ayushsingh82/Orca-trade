const COLORS = ["#9085fb", "#34d399", "#fbbf24", "#f87171", "#60a5fa", "#a3a3a3"];

/** A single stacked bar with a legend. Slices must already be percentages (see allocation()). */
export function AllocationBar({ slices }: { slices: { label: string; value: number; pct: number }[] }) {
  if (slices.length === 0) return <p className="text-sm text-muted-foreground">Nothing held yet.</p>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Allocation">
        {slices.map((s, i) => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: COLORS[i % COLORS.length] }} title={`${s.label} ${s.pct.toFixed(1)}%`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span>{s.label}</span>
            <span className="font-mono text-muted-foreground">
              {s.pct.toFixed(1)}% · ${s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
