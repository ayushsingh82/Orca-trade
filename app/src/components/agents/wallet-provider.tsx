"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { ReactNode } from "react";

const ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

/** Wallet Standard wallets (Phantom, Backpack, Solflare...) are auto-detected; no explicit adapters needed. */
export function SolanaProviders({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider wallets={[]}>{children}</WalletProvider>
    </ConnectionProvider>
  );
}
