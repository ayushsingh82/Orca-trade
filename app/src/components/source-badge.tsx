import { cn } from "@/lib/utils";

/** Orca only serves live data. The upstream provider is deliberately not shown in the UI. */
export function SourceBadge({ className }: { source?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-emerald-400" />
      Live data
    </span>
  );
}
