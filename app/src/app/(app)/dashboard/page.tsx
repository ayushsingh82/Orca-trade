import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SourceBadge } from "@/components/source-badge";
import { ErrorCard } from "@/components/error-card";
import { PageHeader } from "@/components/page-header";
import { buildSignals } from "@/lib/signals";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DIRECTION_STYLE = {
  long: "text-emerald-400",
  short: "text-red-400",
  neutral: "text-muted-foreground",
} as const;

export default async function DashboardPage() {
  let data;
  try {
    data = await buildSignals();
  } catch (e) {
    return <ErrorCard title="Could not load live signals" message={e instanceof Error ? e.message : "Unknown error"} />;
  }
  const { signals, source } = data;
  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Ranked setups with conviction, evidence and contradictions."
      />
      <SourceBadge source={source} className="-mt-4 mb-6" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {signals.map((s) => (
          <Link key={s.id} href={`/signals/${s.asset}`} className="block rounded-xl border bg-card p-5 transition-colors hover:bg-muted">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{s.asset}</h2>
              <span className={cn("text-xs font-medium uppercase", DIRECTION_STYLE[s.direction])}>
                {s.direction}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              ${s.price.toLocaleString()} · {s.change24h >= 0 ? "+" : ""}
              {s.change24h}%
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {s.rationale.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${s.conviction}%` }} />
              </div>
              <span className="font-mono text-xs text-muted-foreground">{s.conviction}</span>
            </div>
            {s.contradictions.length > 0 && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {s.contradictions[0].title}
              </p>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
