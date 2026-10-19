"use client";

import { useState } from "react";

/** Follow or unfollow a token. Shows a hint instead of failing silently when the user is signed out. */
export function WatchStar({ id, symbol, name, initial, loggedIn }: { id: string; symbol: string; name: string; initial: boolean; loggedIn: boolean }) {
  const [on, setOn] = useState(initial);
  const [hint, setHint] = useState<string | null>(null);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={on ? `Unfollow ${symbol}` : `Follow ${symbol}`}
        aria-pressed={on}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!loggedIn) return setHint("Sign in to follow tokens");
          const next = !on;
          setOn(next); // optimistic
          const res = await fetch("/api/watchlist", { method: next ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, symbol, name }) });
          if (!res.ok) {
            setOn(!next);
            setHint((await res.json().catch(() => null))?.error ?? "Could not update");
          }
        }}
        className={`text-lg leading-none transition-colors ${on ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
      >
        {on ? "★" : "☆"}
      </button>
      {hint && <span className="absolute left-6 top-0 z-10 whitespace-nowrap rounded-md border bg-card px-2 py-1 text-[11px] text-muted-foreground">{hint}</span>}
    </span>
  );
}
