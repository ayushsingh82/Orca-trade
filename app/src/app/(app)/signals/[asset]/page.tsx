import { sourceLabel } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { ErrorCard } from "@/components/error-card";
import { getSignal } from "@/lib/signals";
import { cn } from "@/lib/utils";

// Cold starts hit the SoSoValue rate limit (10 req/min), so allow the full Hobby limit.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function SignalPage({ params }: PageProps<"/signals/[asset]">) {
  const { asset } = await params;
  let result;
  try {
    result = await getSignal(asset);
  } catch (e) {
    return <ErrorCard title="Could not load signal" message={e instanceof Error ? e.message : "Unknown error"} />;
  }
  const { signal, source } = result;
  if (!signal) notFound();

  return (
    <>
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Opportunities
      </Link>
      <PageHeader
        title={`${signal.asset} · ${signal.direction}`}
        description={`$${signal.price.toLocaleString()} · ${signal.change24h >= 0 ? "+" : ""}${signal.change24h}% 24h · conviction ${signal.conviction}`}
      />
      <SourceBadge source={source} className="-mt-4 mb-6" />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Rationale</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
            {signal.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Contradictions</h2>
          {signal.contradictions.length ? (
            <ul className="mt-2 space-y-3 text-sm">
              {signal.contradictions.map((c) => (
                <li key={c.id}>
                  <p className={cn("font-medium", c.severity === "high" ? "text-red-400" : "text-amber-400")}>
                    {c.title} <span className="text-xs uppercase">({c.severity})</span>
                  </p>
                  <p className="text-muted-foreground">
                    {c.signalA.label}: {c.signalA.value} ({sourceLabel(c.signalA.source)}) vs {c.signalB.label}: {c.signalB.value} (
                    {sourceLabel(c.signalB.source)})
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">None detected across live sources.</p>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5 md:col-span-2">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Citations</h2>
          {signal.citations.length ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {signal.citations.map((c) => (
                <li key={c.id}>
                  {c.title} <span className="text-muted-foreground">— {sourceLabel(c.source)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No related headlines in the current window.</p>
          )}
        </section>
      </div>
    </>
  );
}
