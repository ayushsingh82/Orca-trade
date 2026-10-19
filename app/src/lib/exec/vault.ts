import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { buildTopUp, effectiveRemaining, readLimitConfig, squadsAddresses, USDC_TOKEN, verifyLimitConfig, type TokenSpec } from "./squads";

/** The vault link stored on an agent (all set together). */
export type VaultLink = { owner: string; multisig: string; limit: string; dailyUsdc: number };

/**
 * Pure: how much to pull from the vault so the agent holds `needed`. Zero if it already does. Throws, so the
 * caller fails closed, when the on-chain daily limit or the vault balance cannot cover the shortfall: a trade is
 * never half-funded.
 */
export function planPull(args: { balance: number; needed: number; remainingRaw: bigint; vaultBalance: number; decimals?: number }): number {
  const decimals = args.decimals ?? USDC_TOKEN.decimals;
  const shortfall = Math.ceil((args.needed - args.balance) * 10 ** decimals) / 10 ** decimals;
  if (!(shortfall > 0)) return 0;
  if (BigInt(Math.round(shortfall * 10 ** decimals)) > args.remainingRaw) {
    throw new Error(`vault daily limit reached: ${Number(args.remainingRaw) / 10 ** decimals} left today, ${shortfall} needed`);
  }
  if (shortfall > args.vaultBalance) throw new Error(`vault holds ${args.vaultBalance}, ${shortfall} needed`);
  return shortfall;
}

async function tokenBalance(connection: Connection, owner: PublicKey, token: TokenSpec): Promise<number> {
  try {
    const bal = await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(token.mint, owner, true));
    return bal.value.uiAmount ?? 0;
  } catch {
    return 0; // no token account yet
  }
}

/**
 * USDC the agent could still draw from its vault right now: the smaller of the vault balance and what is left of
 * the on-chain daily limit. Counted as the agent's capital for risk sizing. An unreadable or unsafe vault counts as
 * zero, so a problem can only make the agent more cautious.
 */
export async function vaultAvailableUsdc(connection: Connection, link: VaultLink, agent: PublicKey, token: TokenSpec = USDC_TOKEN): Promise<number> {
  try {
    const multisigPda = new PublicKey(link.multisig);
    const cfg = await readLimitConfig(connection, multisigPda, new PublicKey(link.limit));
    const problems = verifyLimitConfig(cfg, { owner: link.owner, agent: agent.toBase58(), multisigPda: link.multisig, limitPda: link.limit, token, maxDailyUsdc: link.dailyUsdc });
    if (problems.length) return 0;
    const vault = await tokenBalance(connection, squadsAddresses(multisigPda).vault, token);
    return Math.min(vault, Number(effectiveRemaining(cfg.limit)) / 10 ** token.decimals);
  } catch {
    return 0;
  }
}

export type PullResult = { pulled: number; signature: string | null; simulated: boolean };

/**
 * Tops up the agent wallet from its owner's Squads vault, within the on-chain daily limit. The vault is re-read
 * and re-verified on every call, so a changed or tampered configuration blocks funding instead of being trusted.
 */
export async function pullFromVault(args: {
  connection: Connection;
  agent: Keypair;
  link: VaultLink;
  neededUsdc: number;
  send: boolean;
  token?: TokenSpec;
}): Promise<PullResult> {
  const token = args.token ?? USDC_TOKEN;
  const multisigPda = new PublicKey(args.link.multisig);
  const limitPda = new PublicKey(args.link.limit);

  const cfg = await readLimitConfig(args.connection, multisigPda, limitPda);
  const problems = verifyLimitConfig(cfg, {
    owner: args.link.owner,
    agent: args.agent.publicKey.toBase58(),
    multisigPda: args.link.multisig,
    limitPda: args.link.limit,
    token,
    maxDailyUsdc: args.link.dailyUsdc,
  });
  if (problems.length) throw new Error(`vault configuration is not safe: ${problems.join("; ")}`);

  const [balance, vaultBalance] = await Promise.all([
    tokenBalance(args.connection, args.agent.publicKey, token),
    tokenBalance(args.connection, squadsAddresses(multisigPda).vault, token),
  ]);
  const pull = planPull({ balance, needed: args.neededUsdc, remainingRaw: effectiveRemaining(cfg.limit), vaultBalance, decimals: token.decimals });
  if (pull === 0) return { pulled: 0, signature: null, simulated: false };

  const tx = new Transaction().add(...buildTopUp({ multisigPda, spendingLimitPda: limitPda, agentWallet: args.agent.publicKey, usdc: pull, token }));
  const latest = await args.connection.getLatestBlockhash();
  tx.feePayer = args.agent.publicKey;
  tx.recentBlockhash = latest.blockhash;
  tx.sign(args.agent);

  if (!args.send) {
    const sim = await args.connection.simulateTransaction(tx);
    if (sim.value.err) throw new Error(`vault top-up simulation failed: ${JSON.stringify(sim.value.err)}`);
    return { pulled: pull, signature: null, simulated: true };
  }
  const signature = await args.connection.sendRawTransaction(tx.serialize());
  const conf = await args.connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (conf.value.err) throw new Error(`vault top-up failed on-chain: ${JSON.stringify(conf.value.err)}`);
  return { pulled: pull, signature, simulated: false };
}
