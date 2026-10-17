import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { Keypair } from "@solana/web3.js";
import type { Proposal } from "@/lib/risk/types";
import { EXECUTION_ENABLED, RPC_URL } from "./config";
import { buildSwapTransaction, getQuote } from "./jupiter";
import { TOKENS, USDC } from "./mints";

export type ExecResult =
  | { kind: "executed"; signature: string; quotedOutAmount: string }
  | { kind: "simulated"; quotedOutAmount: string; unitsConsumed: number | null; error: string | null };

/**
 * quote -> build -> sign -> simulate -> (send if enabled). Simulation runs against real
 * mainnet state, so an unfunded agent wallet fails honestly rather than "passing".
 * Sending requires EXECUTION_ENABLED=1.
 */
export async function executeProposal(proposal: Proposal, signer: Keypair, usdPerUnit: number): Promise<ExecResult> {
  const token = TOKENS[proposal.asset.toUpperCase()];
  if (!token) throw new Error(`${proposal.asset} is not tradable on Solana via Orca`);
  if (!(usdPerUnit > 0)) throw new Error("no live price for sizing");

  const buy = proposal.side === "buy";
  const input = buy ? USDC : token;
  const output = buy ? token : USDC;
  const inUnits = buy ? proposal.sizeUsd : proposal.sizeUsd / usdPerUnit;
  const amount = BigInt(Math.floor(inUnits * 10 ** input.decimals));
  if (amount <= BigInt(0)) throw new Error("trade size rounds to zero");

  const quote = await getQuote({
    inputMint: input.mint,
    outputMint: output.mint,
    amount,
    slippageBps: proposal.maxSlippageBps,
  });
  const tx = VersionedTransaction.deserialize(Buffer.from(await buildSwapTransaction(quote, signer.publicKey.toBase58()), "base64"));
  tx.sign([signer]);

  const connection = new Connection(RPC_URL, "confirmed");
  if (!EXECUTION_ENABLED) {
    const sim = await connection.simulateTransaction(tx, { sigVerify: true });
    return {
      kind: "simulated",
      quotedOutAmount: quote.outAmount,
      unitsConsumed: sim.value.unitsConsumed ?? null,
      error: sim.value.err ? JSON.stringify(sim.value.err) : null,
    };
  }

  const signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  const latest = await connection.getLatestBlockhash();
  const conf = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (conf.value.err) throw new Error(`transaction failed on-chain: ${JSON.stringify(conf.value.err)}`);
  return { kind: "executed", signature, quotedOutAmount: quote.outAmount };
}
