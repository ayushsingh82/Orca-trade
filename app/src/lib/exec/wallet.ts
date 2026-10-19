import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "./config";
import { USDC } from "./mints";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/** Real on-chain SOL and USDC held by a wallet. */
export async function readWalletBalances(address: string): Promise<{ sol: number; usdc: number }> {
  const connection = new Connection(RPC_URL, "confirmed");
  const owner = new PublicKey(address);
  const [lamports, accounts] = await Promise.all([
    connection.getBalance(owner),
    connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(USDC.mint), programId: TOKEN_PROGRAM }),
  ]);
  const usdc = accounts.value.reduce((s, { account }) => s + (account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
  return { sol: lamports / 1e9, usdc };
}
