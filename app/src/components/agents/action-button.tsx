"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** POSTs to an agent/decision action endpoint and refreshes the page. */
export function ActionButton({ url, label, busyLabel }: { url: string; label: string; busyLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const json = await (await fetch(url, { method: "POST" })).json();
            if (!json.ok) throw new Error(json.error);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        {busy ? busyLabel : label}
      </button>
      {error && <span className="max-w-xs text-xs text-red-400">{error}</span>}
    </span>
  );
}
