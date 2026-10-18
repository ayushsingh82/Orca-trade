"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";

type Linked = { vault: string; dailyUsdc: number };

/**
 * Optional on-chain funding cap. The user creates a Squads vault they alone control and adds one daily limit that
 * only this agent can use. Orca then funds the agent from the vault per trade, so the program, not Orca's server,
 * bounds how much the agent can ever hold.
 */
export function VaultSetup({ agentId, linked }: { agentId: string; linked: Linked | null }) {
  const router = useRouter();
  const { connection } = useConnection();
  const { wallets, wallet, select, connect, connected, publicKey, sendTransaction } = useWallet();
  const [daily, setDaily] = useState("50");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const dailyUsdc = Number(daily);
      if (!(dailyUsdc > 0)) throw new Error("enter a daily limit in USDC");
      if (!publicKey) throw new Error("connect a wallet first");
      const res = await fetch(`/api/agents/${agentId}/vault/setup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dailyUsdc, creator: publicKey.toBase58() }),
      });
      const setup = await res.json();
      if (!setup.ok) throw new Error(setup.error);
      setMsg("Approve the transaction in your wallet…");
      const signature = await sendTransaction(Transaction.from(Buffer.from(setup.transaction, "base64")), connection);
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature, ...latest }, "confirmed");
      setMsg("Verifying the vault on chain…");
      const confirm = await (
        await fetch(`/api/agents/${agentId}/vault/confirm`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ multisig: setup.multisig, limit: setup.limit, owner: publicKey.toBase58(), dailyUsdc }),
        })
      ).json();
      if (!confirm.ok) throw new Error(confirm.error);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create the vault");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    await fetch(`/api/agents/${agentId}/vault/confirm`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (linked) {
    return (
      <div className="mt-4 rounded-lg border bg-muted p-3 text-xs">
        <p className="font-medium text-emerald-400">On-chain cap active: ${linked.dailyUsdc}/day</p>
        <p className="mt-1 text-muted-foreground">
          Deposit USDC to your vault. The agent can pull at most ${linked.dailyUsdc} per day from it, enforced by the Squads program.
        </p>
        <p className="mt-1 break-all font-mono text-[11px]">Vault: {linked.vault}</p>
        <button onClick={unlink} disabled={busy} className="mt-2 rounded-md border px-2.5 py-1 hover:bg-card disabled:opacity-50">
          Unlink from Orca
        </button>
        <p className="mt-1 text-muted-foreground">Unlinking only stops Orca using it. To revoke the agent&apos;s access on chain, remove the limit in your vault.</p>
      </div>
    );
  }

  const detected = wallets.filter((w) => w.readyState === "Installed");
  return (
    <div className="mt-4 rounded-lg border bg-muted p-3 text-xs">
      <p className="font-medium">On-chain funding cap (optional)</p>
      <p className="mt-1 text-muted-foreground">
        Keep funds in a vault only you control. The agent may pull at most a daily limit from it, enforced on chain, instead of holding everything you give it.
      </p>
      {!connected ? (
        detected.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {detected.map((w) => (
              <button
                key={w.adapter.name}
                onClick={async () => {
                  select(w.adapter.name);
                  try {
                    await connect();
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Could not connect");
                  }
                }}
                className="rounded-md border px-2.5 py-1 hover:bg-card"
              >
                Connect {w.adapter.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground">No Solana wallet detected. Install Phantom to set this up.</p>
        )
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{wallet?.adapter.name}</span>
          <input value={daily} onChange={(e) => setDaily(e.target.value)} className="w-20 rounded-md border bg-card px-2 py-1 outline-none focus:border-accent" />
          <span className="text-muted-foreground">USDC per day</span>
          <button onClick={create} disabled={busy} className="rounded-md bg-accent px-2.5 py-1 text-accent-foreground disabled:opacity-50">
            {busy ? "Working…" : "Create vault"}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 font-mono text-muted-foreground">{msg}</p>}
    </div>
  );
}
