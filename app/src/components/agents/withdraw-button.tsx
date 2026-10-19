"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const explorer = (sig: string) => `https://solscan.io/tx/${sig}`;

/** Sends funds from a live agent back to the owner's own wallet. The destination is fixed on the server. */
export function WithdrawButton({ agentId, agentName, destination }: { agentId: string; agentName: string; destination: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<"ALL" | "USDC" | "SOL">("ALL");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ asset: string; amount: number; signature: string }[] | null>(null);

  if (!destination) {
    return <p className="text-xs text-muted-foreground">Add a wallet to withdraw: sign in with email or Google, or with your own wallet.</p>;
  }
  const short = `${destination.slice(0, 4)}…${destination.slice(-4)}`;

  async function submit() {
    const what = asset === "ALL" ? "everything" : `${amount || "all"} ${asset}`;
    if (!window.confirm(`Withdraw ${what} from ${agentName} to your wallet ${short}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await (
        await fetch(`/api/agents/${agentId}/withdraw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset, amount: asset !== "ALL" && amount ? Number(amount) : undefined }),
        })
      ).json();
      if (!res.ok) throw new Error(res.error);
      setDone(res.moved);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">
        Withdraw
      </button>
    );
  }
  return (
    <div className="w-full rounded-lg border bg-muted p-3 text-xs">
      <p className="font-medium">Withdraw to your wallet {short}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={asset} onChange={(e) => setAsset(e.target.value as "ALL" | "USDC" | "SOL")} className="rounded-md border bg-card px-2 py-1">
          <option value="ALL">Everything</option>
          <option value="USDC">USDC</option>
          <option value="SOL">SOL</option>
        </select>
        {asset !== "ALL" && (
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="All" className="w-24 rounded-md border bg-card px-2 py-1 outline-none focus:border-accent" />
        )}
        <button onClick={submit} disabled={busy} className="rounded-md bg-accent px-2.5 py-1 text-accent-foreground disabled:opacity-50">
          {busy ? "Sending…" : "Withdraw"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border px-2.5 py-1 hover:bg-card">
          Close
        </button>
      </div>
      <p className="mt-2 text-muted-foreground">Funds can only go to your own wallet. Withdrawing everything also sends the agent&apos;s SOL, so it can no longer pay fees.</p>
      {error && <p className="mt-2 font-mono text-red-400">{error}</p>}
      {done && (
        <ul className="mt-2 space-y-0.5 font-mono">
          {done.map((m) => (
            <li key={m.signature + m.asset}>
              Sent {m.amount} {m.asset.length > 8 ? `${m.asset.slice(0, 4)}…` : m.asset} ·{" "}
              <a className="text-accent underline" href={explorer(m.signature)} target="_blank" rel="noreferrer">
                view
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
