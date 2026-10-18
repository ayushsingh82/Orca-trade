// Provider names and env var names stay out of the UI.
const SCRUB: [RegExp, string][] = [
  [/SOSO_API_KEY|SODEX\w*|SoSoValue|SoDEX|CoinGecko|Jupiter/gi, "data provider"],
];

export function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-red-400/30 bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-red-400">{title}</h2>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{SCRUB.reduce((m, [re, to]) => m.replace(re, to), message)}</p>
    </div>
  );
}
