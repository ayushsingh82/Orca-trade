export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="h-4 w-80 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-card" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl border bg-card" />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Loading live data. The first load can take a minute because of provider rate limits.</p>
    </div>
  );
}
