"use client";

import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SourceBadge } from "@/components/source-badge";
import { ErrorCard } from "@/components/error-card";
import type { AskResponse } from "@/lib/intel/types";

const SUGGESTIONS = [
  "What's driving BTC right now?",
  "Why is ETH moving today?",
  "Which sectors are leading and is it confirmed by news?",
  "How risky is the macro calendar this week?",
];

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AskResponse | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (json.ok) {
        setAnalysis(json.data.analysis);
        setSource(json.source);
      } else {
        setAnalysis(null);
        setError(json.error ?? "Ask failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) submit(query.trim());
  }

  return (
    <>
      <PageHeader
        title="Ask Orca"
        description="Cited answers grounded in live SoSoValue data. Contradictions are surfaced, not hidden."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Why is BTC moving?"
          className="flex-1 rounded-lg border bg-card px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={loading || !query.trim()}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuery(s);
              submit(s);
            }}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-8">
          <ErrorCard title="Could not answer" message={error} />
        </div>
      )}

      {analysis && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {source && <SourceBadge source={source} />}
            <span className="font-mono text-xs text-muted-foreground">
              confidence {Math.round(analysis.confidence * 100)}%
            </span>
          </div>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Thesis</h2>
            <p className="mt-2 text-lg">{analysis.thesis}</p>
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="Causes" items={analysis.causes} />
            <ListCard title="Contradictions" items={analysis.contradictions} empty="None detected in the data." />
          </div>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {analysis.evidence.map((e, i) => (
                <li key={i}>
                  <span className="font-mono text-xs text-accent">{e.label}</span> {e.value}
                  <span className="text-muted-foreground"> — {e.source}</span>
                </li>
              ))}
            </ul>
          </section>
          {analysis.impact && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Impact</h2>
              <p className="mt-2 text-sm">{analysis.impact}</p>
            </section>
          )}
          <ListCard title="Citations" items={analysis.citations.map((c) => `${c.title} — ${c.source}`)} />
        </div>
      )}
    </>
  );
}

function ListCard({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground">{title}</h2>
      {items.length ? (
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty ?? "—"}</p>
      )}
    </section>
  );
}
