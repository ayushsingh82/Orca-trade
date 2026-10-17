import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { Keypair } from "@solana/web3.js";
import type { Proposal } from "@/lib/risk/types";
import { EXECUTION_ENABLED, JITO_TIP_LAMPORTS, RPC_URL } from "./config";
import { sendViaJito } from "./jito";
import { buildSwapTransaction } from "./jupiter";
import { quoteProposal } from "./pricing";

export type ExecResult =
  | { kind: "executed"; signature: string; quotedOutAmount: string }
  | { kind: "simulated"; quotedOutAmount: string; unitsConsumed: number | null; error: string | null };

/**
 * quote -> price-check -> build -> sign -> simulate -> (send if enabled). Simulation runs against real
 * mainnet state, so an unfunded agent wallet fails honestly rather than "passing".
 * Sending requires EXECUTION_ENABLED=1.
 */
export async function executeProposal(proposal: Proposal, signer: Keypair, usdPerUnit: number): Promise<ExecResult> {
  const { quote } = await quoteProposal(proposal, usdPerUnit);
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

  // With a Jito tip configured, land the swap as a private bundle; otherwise use the normal RPC path.
  const signature = JITO_TIP_LAMPORTS > 0 ? await sendViaJito(tx) : await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  const latest = await connection.getLatestBlockhash();
  const conf = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (conf.value.err) throw new Error(`transaction failed on-chain: ${JSON.stringify(conf.value.err)}`);
  return { kind: "executed", signature, quotedOutAmount: quote.outAmount };
}
