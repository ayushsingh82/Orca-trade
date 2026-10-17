"use client";

import { FormEvent, useState } from "react";

/** Connects Telegram alerts. The user messages the Orca bot first, then pastes their numeric chat id. */
export function TelegramForm() {
  const [chatId, setChatId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    });
    const json = await res.json();
    setMsg(json.ok ? (chatId ? "Connected. Check Telegram for a test message." : "Alerts turned off.") : json.error);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 rounded-xl border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Alerts</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Get a Telegram message for every execution, approval request and blocked action. Message the Orca bot, then paste your chat id.
        Leave empty to turn off.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Telegram chat id"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">Save</button>
      </div>
      {msg && <p className="mt-2 font-mono text-xs text-muted-foreground">{msg}</p>}
    </form>
  );
}
