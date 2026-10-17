"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Owner-only on/off switch posting `{ [field]: boolean }` (e.g. share a decision, list an agent). */
export function ToggleButton({ url, field, on, labelOn, labelOff }: { url: string; field: string; on: boolean; labelOn: string; labelOff: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const json = await (
            await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: !on }) })
          ).json();
          setBusy(false);
          if (json.ok) {
            setLink(!on && json.url ? json.url : null);
            router.refresh();
          }
        }}
        className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        {on ? labelOn : labelOff}
      </button>
      {link && <span className="break-all font-mono text-[11px] text-muted-foreground">{link}</span>}
    </span>
  );
}
