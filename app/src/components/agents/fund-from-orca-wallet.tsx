"use client";

import { useState } from "react";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

/** Sends SOL or USDC from the user's own Orca wallet to one agent's wallet. The agent can only spend what is sent here. */
export function FundFromOrcaWallet({ fromAddress, agentAddress }: { fromAddress: string; agentAddress: string }) {
  const { wallets, ready } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [token, setToken] = useState<"USDC" | "SOL">("USDC");
  const [amount, setAmount] = useState("10");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const value = Number(amount);
      if (!(value > 0)) throw new Error("enter an amount");
      const wallet = wallets.find((w) => w.address === fromAddress);
      if (!wallet) throw new Error("Your Orca wallet is not ready yet. Try again in a moment.");
      const from = new PublicKey(fromAddress);
      const to = new PublicKey(agentAddress);
      const tx = new Transaction();
      if (token === "SOL") {
        tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Math.round(value * LAMPORTS_PER_SOL) }));
      } else {
        const fromAta = getAssociatedTokenAddressSync(USDC_MINT, from);
        const toAta = getAssociatedTokenAddressSync(USDC_MINT, to);
        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(from, toAta, to, USDC_MINT),
          createTransferCheckedInstruction(fromAta, USDC_MINT, toAta, from, Math.round(value * 1e6), 6),
        );
      }
      const connection = new Connection(RPC, "confirmed");
      tx.feePayer = from;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      await signAndSendTransaction({ transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }), wallet });
      setMsg(`Sent ${value} ${token} to the agent. It can take a few seconds to arrive.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 text-xs">
      <p className="mb-1.5 text-muted-foreground">Fund this agent from your Orca wallet</p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-20 rounded-md border bg-card px-2 py-1 outline-none focus:border-accent" />
        <select value={token} onChange={(e) => setToken(e.target.value as "USDC" | "SOL")} className="rounded-md border bg-card px-2 py-1">
          <option>USDC</option>
          <option>SOL</option>
        </select>
        <button onClick={send} disabled={busy || !ready} className="rounded-md bg-accent px-2.5 py-1 text-accent-foreground disabled:opacity-50">
          {busy ? "Sending…" : "Send to agent"}
        </button>
      </div>
      <p className="mt-1 text-muted-foreground">Send USDC to trade and a little SOL for network fees.</p>
      {msg && <p className="mt-1 font-mono text-muted-foreground">{msg}</p>}
    </div>
  );
}
