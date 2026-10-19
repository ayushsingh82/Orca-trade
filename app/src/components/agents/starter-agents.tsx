"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STARTERS, STARTER_POLICY } from "@/lib/agents/starters";

/** Creates a paper agent and runs it straight away, so the user sees live output within a minute. */
export function StarterAgents({ existing }: { existing: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const todo = STARTERS.filter((s) => !existing.includes(s.name));
  if (todo.length === 0) return null;

  async function add(name: string, strategy: string) {
    setBusy(name);
    setMsg(null);
    try {
      const created = await (
        await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, strategy, paper: true, policy: STARTER_POLICY }),
        })
      ).json();
      if (!created.ok) throw new Error(created.error);
      setMsg(`Running ${name} on live data. The first run can take up to a minute…`);
      const run = await (await fetch(`/api/agents/${created.agent.id}/run`, { method: "POST" })).json();
      if (!run.ok) throw new Error(run.error);
      setMsg(null);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not add the agent");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-6 rounded-xl border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Start with a live agent</h2>
      <p className="mt-1 text-xs text-muted-foreground">Each one is a paper agent in observe mode: it reads live data and reports what it would do. Nothing is traded.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {todo.map((s) => (
          <div key={s.name} className="flex flex-col rounded-lg border bg-muted p-4">
            <h3 className="font-medium">{s.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{s.blurb}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{s.data}</p>
            <button
              onClick={() => add(s.name, s.strategy)}
              disabled={busy !== null}
              className="mt-4 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy === s.name ? "Running…" : "Add and run"}
            </button>
          </div>
        ))}
      </div>
      {msg && <p className="mt-3 font-mono text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}
