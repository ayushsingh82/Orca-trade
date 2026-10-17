import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { decisions } from "@/db/schema";
import { BrandLogo } from "@/components/brand";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Public, read-only Decision Record. Shows reasoning and risk checks; never the agent wallet or owner. */
export default async function SharedDecision({ params }: PageProps<"/d/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [d] = await db().select().from(decisions).where(eq(decisions.id, id)).limit(1);
  if (!d || !d.shared) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 md:py-12">
      <BrandLogo />
      <header>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Decision Record · {d.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          {d.proposal ? `${d.proposal.side === "buy" ? "Buy" : "Sell"} ${d.proposal.asset} · $${d.proposal.sizeUsd}` : "No action"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Outcome: <span className="text-foreground">{d.status}</span>
          {d.fillPrice ? ` at $${d.fillPrice.toFixed(2)}` : ""} · data: {d.signalSource}
        </p>
      </header>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Why</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
          {d.rationale.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>
      {d.citations.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {d.citations.map((c) => (
              <li key={c.id}>
                {c.title} <span className="text-muted-foreground">— {c.source}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Risk checks</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {d.checks.length === 0 && <li className="text-muted-foreground">No proposal, so no checks ran.</li>}
          {d.checks.map((c) => (
            <li key={c.rule} className={c.passed ? "text-muted-foreground" : "text-red-400"}>
              {c.passed ? "✓" : "✗"} {c.rule}: {c.detail}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">Not financial advice. Paper or live, past decisions do not predict future results.</p>
    </div>
  );
}
