import type { BotView } from "@/lib/bots";
import { cn } from "@/lib/utils";

const VERDICT: Record<string, { text: string; style: string }> = {
  needs_approval: { text: "Would ask you to approve", style: "text-amber-300" },
  allow: { text: "Would execute", style: "text-emerald-400" },
  reject: { text: "Blocked by the Risk Engine", style: "text-red-400" },
  log_only: { text: "Logged only", style: "text-muted-foreground" },
};

const WATCH = /^(\S+) (\$[\d.,]+) (long|short|neutral) (\d+)$/;
const DIR_STYLE: Record<string, string> = { long: "text-emerald-400", short: "text-red-400", neutral: "text-muted-foreground" };

/** "Watching: A · B · C" as small chips instead of one long line. Returns null if the line isn't in that shape. */
function WatchChips({ line, max }: { line: string; max: number }) {
  if (!line.startsWith("Watching: ")) return null;
  const items = line.slice("Watching: ".length).split(" · ").map((x) => WATCH.exec(x.trim()));
  if (items.some((m) => !m)) return null;
  const rows = items as RegExpExecArray[];
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Watching</p>
      <div className="flex flex-wrap gap-1.5">
        {rows.slice(0, max).map(([, sym, price, dir, conv]) => (
          <span key={sym} className="rounded-md border bg-muted px-2 py-1 font-mono text-[10px]">
            <span className="text-foreground">{sym}</span> <span className="text-muted-foreground">{price}</span>{" "}
            <span className={DIR_STYLE[dir]}>{dir} {conv}</span>
          </span>
        ))}
        {rows.length > max && <span className="px-1 py-1 font-mono text-[10px] text-muted-foreground">+{rows.length - max} more</span>}
      </div>
    </div>
  );
}

/** One strategy running on live data, with the Risk Engine's verdict when it wants to trade. */
export function BotCard({ b, compact = false }: { b: BotView; compact?: boolean }) {
  const v = b.verdict ? VERDICT[b.verdict] : null;
  return (
    <article className="flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-white/20">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{b.name}</h3>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-emerald-400">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Running
        </span>
      </div>
      {!compact && <p className="mt-1 text-xs text-muted-foreground">{b.blurb}</p>}
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{b.data}</p>

      <div className="mt-4 rounded-lg border bg-muted p-3">
        {b.proposal ? (
          <p className="text-sm font-medium">
            {b.proposal.side === "buy" ? "Wants to buy" : "Wants to sell"} {b.proposal.asset} · ${b.proposal.sizeUsd}
            <span className="ml-2 font-mono text-xs text-muted-foreground">conviction {b.proposal.conviction}</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">No trade right now</p>
        )}
        {v && <p className={cn("mt-1 text-xs", v.style)}>{v.text}</p>}
      </div>

      <ul className="mt-3 space-y-2.5 text-xs text-muted-foreground">
        {b.rationale.slice(0, compact ? 2 : 6).map((r) => (
          <li key={r}>{WatchChips({ line: r, max: compact ? 4 : 8 }) ?? r}</li>
        ))}
      </ul>

      {!compact && b.checks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {b.checks.map((c) => (
            <span key={c.rule} title={c.detail} className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", c.passed ? "border-emerald-400/30 text-emerald-300" : "border-red-400/40 text-red-300")}>
              {c.passed ? "✓" : "✗"} {c.rule.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
