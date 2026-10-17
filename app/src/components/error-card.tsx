export function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-red-400/30 bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-red-400">{title}</h2>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
