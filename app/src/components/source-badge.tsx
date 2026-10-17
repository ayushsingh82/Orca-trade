import { cn } from "@/lib/utils";

/** Shows where a payload came from. Orca only serves live data, so this is provenance, not a mock flag. */
export function SourceBadge({ source, className }: { source: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-emerald-400" />
      live · {source}
    </span>
  );
}
