import type { Sentiment } from "@/lib/sentiment";
import { cn } from "@/lib/utils";

const LABEL_STYLE = { "Risk-on": "text-emerald-400", "Risk-off": "text-red-400", Mixed: "text-amber-300" } as const;

/** A bar from -100 to +100 with the reading as a dot. Shared by the page, the dashboard and the landing widget. */
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative h-2 rounded-full bg-muted" role="img" aria-label={`Score ${score} out of 100`}>
      <div className="absolute inset-y-0 left-0 w-1/2 rounded-l-full bg-red-400/15" />
      <div className="absolute inset-y-0 right-0 w-1/2 rounded-r-full bg-emerald-400/15" />
      <div
        className={cn("absolute inset-y-0", score < 0 ? "rounded-l-full bg-red-400/60" : "rounded-r-full bg-emerald-400/60")}
        style={score < 0 ? { right: "50%", width: `${-score / 2}%` } : { left: "50%", width: `${score / 2}%` }}
      />
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <div className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-background bg-foreground" style={{ left: `${(score + 100) / 2}%` }} />
    </div>
  );
}

export function SentimentView({ s, compact = false }: { s: Sentiment; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Market mood</p>
          <p className={cn("font-display text-3xl font-semibold", LABEL_STYLE[s.label])}>{s.label}</p>
        </div>
        <p className={cn("rounded-lg border bg-muted px-3 py-1 font-mono text-xl font-semibold", LABEL_STYLE[s.label])}>{s.score > 0 ? "+" : ""}{s.score}</p>
      </div>
      <div className="mt-3">
        <ScoreBar score={s.score} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>Risk-off</span>
          <span>Mixed</span>
          <span>Risk-on</span>
        </div>
      </div>
      <ul className={cn("mt-5 space-y-3 border-t pt-4", compact && "space-y-2.5")}>
        {s.components.map((c) => (
          <li key={c.key}>
            <div className="flex items-center justify-between text-sm">
              <span>{c.label}</span>
              <span className={cn("font-mono text-xs", c.score > 10 ? "text-emerald-400" : c.score < -10 ? "text-red-400" : "text-muted-foreground")}>{c.score > 0 ? "+" : ""}{c.score}</span>
            </div>
            <ScoreBar score={c.score} />
            {!compact && <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Based on {s.used} of 4 live inputs ({s.confidence} confidence).
      </p>
    </div>
  );
}
