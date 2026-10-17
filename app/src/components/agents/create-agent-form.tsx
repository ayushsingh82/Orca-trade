"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorCard } from "@/components/error-card";

const STRATEGIES = [
  { id: "momentum", label: "Momentum", hint: "Follow the strongest directional signal" },
  { id: "narrative_rotation", label: "Narrative Rotation", hint: "Act only on news-backed moves" },
];
const MODES = ["observe", "propose", "autonomous"];

export function CreateAgentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState("momentum");
  const [mode, setMode] = useState("observe");
  const [maxTradeUsd, setMaxTradeUsd] = useState(25);
  const [maxDailyUsd, setMaxDailyUsd] = useState(100);
  const [minConviction, setMinConviction] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, strategy, policy: { mode, maxTradeUsd, maxDailyUsd, minConviction } }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create agent");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:border-accent";
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">New agent</h2>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" className={field} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Strategy
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className={field}>
            {STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.hint}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value)} className={field}>
            {MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Max per trade (USD)
          <input type="number" min={1} value={maxTradeUsd} onChange={(e) => setMaxTradeUsd(Number(e.target.value))} className={field} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Max per day (USD)
          <input type="number" min={1} value={maxDailyUsd} onChange={(e) => setMaxDailyUsd(Number(e.target.value))} className={field} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Min conviction (0-100)
          <input type="number" min={0} max={100} value={minConviction} onChange={(e) => setMinConviction(Number(e.target.value))} className={field} />
        </label>
      </div>
      <button disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50">
        {busy ? "Creating…" : "Create agent"}
      </button>
      {error && <ErrorCard title="Could not create agent" message={error} />}
    </form>
  );
}
