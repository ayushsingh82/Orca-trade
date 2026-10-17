"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

/** Sends SOL from the user's own wallet to the agent signer. The agent can only ever spend what is sent here. */
export function FundAgent({ address }: { address: string }) {
  const { connection } = useConnection();
  const { wallets, wallet, select, connect, connected, publicKey, sendTransaction } = useWallet();
  const [amount, setAmount] = useState("0.05");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function fund() {
    setBusy(true);
    setMsg(null);
    try {
      const sol = Number(amount);
      if (!(sol > 0)) throw new Error("enter an amount");
      if (!publicKey) throw new Error("connect a wallet first");
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(address), lamports: Math.round(sol * LAMPORTS_PER_SOL) }),
      );
      const sig = await sendTransaction(tx, connection);
      setMsg(`Sent. Signature ${sig.slice(0, 12)}…`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  const detected = wallets.filter((w) => w.readyState === "Installed");

  return (
    <div className="mt-3 space-y-2 text-xs">
      {!connected ? (
        detected.length ? (
          <div className="flex flex-wrap gap-2">
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
                className="rounded-md border px-2.5 py-1 hover:bg-muted"
              >
                Connect {w.adapter.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No Solana wallet detected. Install Phantom, or send funds to the address above directly.</p>
        )
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{wallet?.adapter.name}</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-20 rounded-md border bg-card px-2 py-1 outline-none focus:border-accent"
          />
          <span className="text-muted-foreground">SOL</span>
          <button onClick={fund} disabled={busy} className="rounded-md bg-accent px-2.5 py-1 text-accent-foreground disabled:opacity-50">
            {busy ? "Sending…" : "Fund agent"}
          </button>
        </div>
      )}
      {msg && <p className="font-mono text-muted-foreground">{msg}</p>}
    </div>
  );
}
