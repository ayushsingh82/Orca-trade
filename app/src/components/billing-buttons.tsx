"use client";

import { useState } from "react";

/** Starts a Stripe Checkout (upgrade) or Billing Portal (manage) session and redirects. */
export function BillingButton({ endpoint, body, label }: { endpoint: string; body?: unknown; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body ?? {}),
            });
            const json = await res.json();
            if (!json.ok || !json.url) throw new Error(json.error ?? "Could not start billing");
            window.location.assign(json.url);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
            setBusy(false);
          }
        }}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
