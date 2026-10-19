"use client";

import { useState } from "react";
import { TRADABLE, type TokenRisk } from "@/lib/exec/mints";
import { cn } from "@/lib/utils";

const GROUPS: { risk: TokenRisk; label: string; note: string }[] = [
  { risk: "core", label: "Large caps", note: "Selected by default" },
  { risk: "standard", label: "Established Solana tokens", note: "Lower liquidity than the large caps" },
  { risk: "high", label: "Memecoins and high-risk", note: "Very volatile. Off by default" },
];

/** Choose which tokens an agent may trade. Only the reviewed tradable list is offered. */
export function TokenPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [q, setQ] = useState("");
  const toggle = (sym: string) => onChange(value.includes(sym) ? value.filter((s) => s !== sym) : [...value, sym]);
  const term = q.trim().toLowerCase();
  const matches = (t: (typeof TRADABLE)[number]) => !term || t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term);

  return (
    <fieldset className="space-y-2 rounded-lg border bg-muted p-3">
      <legend className="px-1 text-xs text-muted-foreground">Tokens this agent may trade ({value.length} selected)</legend>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the tradable list…" aria-label="Search tradable tokens" className="w-full rounded-md border bg-card px-3 py-1.5 text-xs outline-none focus:border-accent" />
      {GROUPS.map((g) => {
        const items = TRADABLE.filter((t) => t.risk === g.risk && matches(t));
        if (items.length === 0) return null;
        const all = TRADABLE.filter((t) => t.risk === g.risk).map((t) => t.symbol);
        const allOn = all.every((s) => value.includes(s));
        return (
          <div key={g.risk}>
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {g.label} · {g.note}
              </span>
              <button type="button" onClick={() => onChange(allOn ? value.filter((s) => !all.includes(s)) : [...new Set([...value, ...all])])} className="underline hover:text-foreground">
                {allOn ? "Clear" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((t) => {
                const on = value.includes(t.symbol);
                return (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => toggle(t.symbol)}
                    aria-pressed={on}
                    title={t.name}
                    className={cn("rounded-md border px-2.5 py-1 text-xs transition-colors", on ? "border-accent bg-accent/15 text-foreground" : "bg-card text-muted-foreground hover:text-foreground", g.risk === "high" && on && "border-amber-400/60 bg-amber-400/10")}
                  >
                    {t.symbol}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {value.some((s) => TRADABLE.find((t) => t.symbol === s)?.risk === "high") && (
        <p className="text-[11px] text-amber-300">Includes high-risk tokens. Use small sizes and a low daily cap.</p>
      )}
    </fieldset>
  );
}
