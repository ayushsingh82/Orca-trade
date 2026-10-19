"use client";

import { useState } from "react";
import { useAddFunds } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "@/components/privy-provider";

const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" as const;

const useRealAddFunds = () => useAddFunds().addFunds;
const useNoAddFunds = () => undefined;
const useAddFundsMaybe = PRIVY_APP_ID ? useRealAddFunds : useNoAddFunds;

/** Copy the deposit address, and open Privy's funding flow (card or crypto) when Privy is enabled. */
export function WalletActions({ address }: { address: string }) {
  const addFunds = useAddFundsMaybe();
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setMsg("Could not copy. Select the address and copy it by hand.");
          }
        }}
        className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
      >
        {copied ? "Copied" : "Copy address"}
      </button>
      {addFunds && (
        <button
          onClick={async () => {
            setMsg(null);
            try {
              await addFunds({ destination: { address, chain: SOLANA_MAINNET, asset: "USDC" }, fiat: {}, crypto: {} });
            } catch (e) {
              // Closing the window rejects too, so only show real errors.
              const m = e instanceof Error ? e.message : "";
              if (m && !/exit|clos|cancel/i.test(m)) setMsg(m);
            }
          }}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          Add funds
        </button>
      )}
      {msg && <p className="w-full font-mono text-xs text-red-400">{msg}</p>}
    </div>
  );
}
