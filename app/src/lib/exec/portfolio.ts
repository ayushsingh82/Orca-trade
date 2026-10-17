import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "./config";
import { TOKENS, USDC } from "./mints";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export type Portfolio = { totalUsd: number; positionsUsd: Record<string, number>; usdc: number; sol: number };

/** Reads the agent wallet's real on-chain balances and values them with live prices (USD per unit). */
export async function readPortfolio(address: string, priceUsd: Record<string, number>): Promise<Portfolio> {
  const connection = new Connection(RPC_URL, "confirmed");
  const owner = new PublicKey(address);
  const [lamports, accounts] = await Promise.all([
    connection.getBalance(owner),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM }),
  ]);

  const byMint = new Map<string, number>();
  for (const { account } of accounts.value) {
    const info = account.data.parsed.info as { mint: string; tokenAmount: { uiAmount: number | null } };
    byMint.set(info.mint, (byMint.get(info.mint) ?? 0) + (info.tokenAmount.uiAmount ?? 0));
  }

  const sol = lamports / 1e9;
  const usdc = byMint.get(USDC.mint) ?? 0;
  const positionsUsd: Record<string, number> = {};
  for (const t of Object.values(TOKENS)) {
    const units = t.symbol === "SOL" ? sol : (byMint.get(t.mint) ?? 0);
    positionsUsd[t.symbol] = units * (priceUsd[t.symbol] ?? 0);
  }
  const totalUsd = usdc + Object.values(positionsUsd).reduce((a, b) => a + b, 0);
  return { totalUsd, positionsUsd, usdc, sol };
}
