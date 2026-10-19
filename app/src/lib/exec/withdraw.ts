import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { USDC } from "./mints";

/** Base network fee for a one-signature transaction. */
export const TX_FEE_LAMPORTS = 5_000;
const MAX_TOKENS_PER_TX = 3;

export type TokenHolding = { mint: string; decimals: number; raw: bigint };
export type WithdrawRequest = { asset: "ALL" | "USDC" | "SOL"; /** In the asset's own units. Omit to take everything of that asset. */ amount?: number };
export type WithdrawPlan = { tokens: TokenHolding[]; /** Lamports to send, or "rest" = whatever is left after fees. */ sol: bigint | "rest" | null };

const toRaw = (amount: number, decimals: number) => BigInt(Math.round(amount * 10 ** decimals));

/**
 * Pure: decides what moves. Validates the request against the agent's real balances so an over-withdrawal
 * fails here with a clear message instead of on chain. ALL sweeps every token the agent holds plus its SOL.
 */
export function planWithdrawal(args: { lamports: bigint; tokens: TokenHolding[]; request: WithdrawRequest }): WithdrawPlan {
  const { lamports, request } = args;
  const held = args.tokens.filter((t) => t.raw > BigInt(0));
  const amount = request.amount;
  if (amount !== undefined && !(amount > 0 && Number.isFinite(amount))) throw new Error("amount must be a positive number");

  if (request.asset === "ALL") {
    if (held.length === 0 && lamports <= BigInt(TX_FEE_LAMPORTS)) throw new Error("the agent wallet is empty");
    return { tokens: held, sol: "rest" };
  }
  if (request.asset === "USDC") {
    const usdc = held.find((t) => t.mint === USDC.mint);
    if (!usdc) throw new Error("the agent holds no USDC");
    const raw = amount === undefined ? usdc.raw : toRaw(amount, usdc.decimals);
    if (raw > usdc.raw) throw new Error(`the agent only holds ${Number(usdc.raw) / 10 ** usdc.decimals} USDC`);
    return { tokens: [{ ...usdc, raw }], sol: null };
  }
  // SOL
  const spendable = lamports - BigInt(TX_FEE_LAMPORTS);
  if (spendable <= BigInt(0)) throw new Error("the agent has no SOL to withdraw");
  if (amount === undefined) return { tokens: [], sol: "rest" };
  const want = toRaw(amount, 9);
  if (want > spendable) throw new Error(`the agent can send at most ${Number(spendable) / LAMPORTS_PER_SOL} SOL after the network fee`);
  return { tokens: [], sol: want };
}

export type WithdrawResult = {
  signatures: string[];
  moved: { asset: string; amount: number; /** The transaction that carried it. */ signature: string }[];
};

async function readHoldings(connection: Connection, owner: PublicKey): Promise<{ lamports: bigint; tokens: TokenHolding[] }> {
  const [lamports, accounts] = await Promise.all([
    connection.getBalance(owner),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
  ]);
  const byMint = new Map<string, TokenHolding>();
  for (const { account } of accounts.value) {
    const info = account.data.parsed.info as { mint: string; tokenAmount: { amount: string; decimals: number } };
    const prev = byMint.get(info.mint);
    byMint.set(info.mint, { mint: info.mint, decimals: info.tokenAmount.decimals, raw: (prev?.raw ?? BigInt(0)) + BigInt(info.tokenAmount.amount) });
  }
  return { lamports: BigInt(lamports), tokens: [...byMint.values()] };
}

async function send(connection: Connection, tx: Transaction, signer: Keypair): Promise<string> {
  const latest = await connection.getLatestBlockhash();
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = latest.blockhash;
  tx.sign(signer);
  const signature = await connection.sendRawTransaction(tx.serialize());
  const conf = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (conf.value.err) throw new Error(`withdrawal failed on chain: ${JSON.stringify(conf.value.err)}`);
  return signature;
}

/**
 * Moves funds from an agent wallet to its owner's wallet. The destination is always a parameter the CALLER fixes
 * (the account owner's own wallet); this function never invents or accepts a third-party address on its own.
 * Tokens go first (the agent pays fees and the owner's token-account rent), then SOL takes whatever remains.
 */
export async function executeWithdrawal(args: { connection: Connection; agent: Keypair; owner: PublicKey; request: WithdrawRequest }): Promise<WithdrawResult> {
  const { connection, agent, owner, request } = args;
  if (owner.equals(agent.publicKey)) throw new Error("destination cannot be the agent wallet itself");

  const before = await readHoldings(connection, agent.publicKey);
  const plan = planWithdrawal({ lamports: before.lamports, tokens: before.tokens, request });
  const signatures: string[] = [];
  const moved: WithdrawResult["moved"] = [];

  for (let i = 0; i < plan.tokens.length; i += MAX_TOKENS_PER_TX) {
    const batch = plan.tokens.slice(i, i + MAX_TOKENS_PER_TX);
    const tx = new Transaction();
    for (const t of batch) {
      const mint = new PublicKey(t.mint);
      const from = getAssociatedTokenAddressSync(mint, agent.publicKey);
      const to = getAssociatedTokenAddressSync(mint, owner, true);
      tx.add(createAssociatedTokenAccountIdempotentInstruction(agent.publicKey, to, owner, mint), createTransferCheckedInstruction(from, mint, to, agent.publicKey, t.raw, t.decimals));
    }
    const signature = await send(connection, tx, agent);
    signatures.push(signature);
    for (const t of batch) moved.push({ asset: t.mint === USDC.mint ? "USDC" : t.mint, amount: Number(t.raw) / 10 ** t.decimals, signature });
  }

  if (plan.sol !== null) {
    // Re-read after the token transfers, because they cost fees and rent.
    const { lamports } = plan.tokens.length ? await readHoldings(connection, agent.publicKey) : before;
    const sendable = lamports - BigInt(TX_FEE_LAMPORTS);
    const amount = plan.sol === "rest" ? sendable : plan.sol < sendable ? plan.sol : sendable;
    if (amount > BigInt(0)) {
      const signature = await send(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: agent.publicKey, toPubkey: owner, lamports: amount })), agent);
      signatures.push(signature);
      moved.push({ asset: "SOL", amount: Number(amount) / LAMPORTS_PER_SOL, signature });
    }
  }
  if (signatures.length === 0) throw new Error("nothing to withdraw");
  return { signatures, moved };
}
