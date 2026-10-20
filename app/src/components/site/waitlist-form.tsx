"use client";

import { FormEvent, useState } from "react";

/** Email capture for the upcoming paid plans. The hidden `website` field is a bot trap. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"pro" | "teams">("pro");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, plan, website: trap }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }

  if (state === "done") {
    return <p className="rounded-lg border border-emerald-400/30 bg-card p-4 text-sm text-emerald-300">You are on the list. We will email you when {plan === "teams" ? "Teams" : "Pro"} opens.</p>;
  }
  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row" aria-label="Join the waitlist">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" className="flex-1 rounded-lg border bg-card px-4 py-2.5 text-sm outline-none focus:border-accent" />
      <select value={plan} onChange={(e) => setPlan(e.target.value as "pro" | "teams")} aria-label="Plan you are interested in" className="rounded-lg border bg-card px-3 py-2.5 text-sm">
        <option value="pro">Pro</option>
        <option value="teams">Teams</option>
      </select>
      <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" aria-hidden name="website" />
      <button disabled={state === "busy"} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
        {state === "busy" ? "Joining…" : "Join the waitlist"}
      </button>
      {error && <p className="w-full text-xs text-red-400 sm:basis-full">{error}</p>}
    </form>
  );
}
