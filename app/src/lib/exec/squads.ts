import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { USDC } from "./mints";

const { Period, Permissions } = multisig.types;

/**
 * On-chain daily cap on how much USDC an agent can ever receive, built on Squads v4 spending limits.
 *
 * Shape: the user owns a Squads vault that holds their funds. A spending limit lets exactly one member (the
 * agent's wallet) pull at most `dailyUsdc` per day from the vault, and only into the agent's own wallet. The
 * agent trades with what is in its wallet, so the user's maximum daily loss to a misbehaving agent is that cap,
 * enforced by the Squads program rather than by Orca's server.
 *
 * Squads spending limits cover transfers only, not swaps, so this caps funding, not individual trades. The
 * Risk Engine still gates each trade.
 */

/** The token the limit is denominated in. USDC by default; tests on a local validator use their own mint. */
export type TokenSpec = { mint: PublicKey; decimals: number };
export const USDC_TOKEN: TokenSpec = { mint: new PublicKey(USDC.mint), decimals: USDC.decimals };

const toRaw = (amount: number, decimals: number = USDC.decimals) => {
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("amount must be a positive number");
  return BigInt(Math.round(amount * 10 ** decimals));
};

export type VaultSetup = {
  instructions: TransactionInstruction[];
  /** Ephemeral key that must co-sign this transaction (the user's wallet signs as creator/config authority). */
  extraSigners: Keypair[];
  multisigPda: PublicKey;
  vaultPda: PublicKey;
  spendingLimitPda: PublicKey;
  /** Public seed of the limit's address (the matching secret is discarded). */
  limitCreateKey: PublicKey;
};

/** Instructions for the user to sign: create a 1-of-1 vault they control, and add the agent's capped daily limit. */
export function buildVaultSetup(args: { creator: PublicKey; agentWallet: PublicKey; dailyUsdc: number; treasury: PublicKey; token?: TokenSpec }): VaultSetup {
  const token = args.token ?? USDC_TOKEN;
  const createKey = Keypair.generate();
  const limitKey = Keypair.generate();
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
  const [spendingLimitPda] = multisig.getSpendingLimitPda({ multisigPda, createKey: limitKey.publicKey });

  const create = multisig.instructions.multisigCreateV2({
    treasury: args.treasury,
    creator: args.creator,
    multisigPda,
    configAuthority: args.creator, // only the user can change limits or move funds
    threshold: 1,
    members: [{ key: args.creator, permissions: Permissions.all() }],
    timeLock: 0,
    createKey: createKey.publicKey,
    rentCollector: null,
  });
  const addLimit = multisig.instructions.multisigAddSpendingLimit({
    multisigPda,
    configAuthority: args.creator,
    spendingLimit: spendingLimitPda,
    rentPayer: args.creator,
    createKey: limitKey.publicKey,
    vaultIndex: 0,
    mint: token.mint,
    amount: toRaw(args.dailyUsdc, token.decimals),
    period: Period.Day,
    members: [args.agentWallet],
    destinations: [args.agentWallet],
  });
  return { instructions: [create, addLimit], // limitKey only seeds the limit's address; the program does not require its signature.
    extraSigners: [createKey], multisigPda, vaultPda, spendingLimitPda, limitCreateKey: limitKey.publicKey };
}

/** Instructions the agent signs to pull `usdc` from the vault into its own wallet, within the on-chain limit. */
export function buildTopUp(args: { multisigPda: PublicKey; spendingLimitPda: PublicKey; agentWallet: PublicKey; usdc: number; token?: TokenSpec }): TransactionInstruction[] {
  const token = args.token ?? USDC_TOKEN;
  const mint = token.mint;
  const raw = toRaw(args.usdc, token.decimals);
  if (raw > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("amount too large");
  const ata = getAssociatedTokenAddressSync(mint, args.agentWallet);
  return [
    createAssociatedTokenAccountIdempotentInstruction(args.agentWallet, ata, args.agentWallet, mint),
    multisig.instructions.spendingLimitUse({
      multisigPda: args.multisigPda,
      member: args.agentWallet,
      spendingLimit: args.spendingLimitPda,
      mint,
      vaultIndex: 0,
      amount: Number(raw),
      decimals: token.decimals,
      destination: args.agentWallet,
      tokenProgram: TOKEN_PROGRAM_ID,
    }),
  ];
}

export const SQUADS_PROGRAM_ID = multisig.PROGRAM_ID;

// ---------------------------------------------------------------------------
// Reading the vault back from chain, and refusing to trust anything unverified
// ---------------------------------------------------------------------------

const DAY_SECONDS = BigInt(86_400);

/** Plain-data view of the two on-chain accounts, so verification is a pure function. */
export type OnChainLimit = {
  multisig: { configAuthority: string; threshold: number; members: string[]; owner: string };
  limit: {
    multisig: string;
    createKey: string;
    vaultIndex: number;
    mint: string;
    amount: bigint;
    period: number;
    remainingAmount: bigint;
    lastReset: bigint;
    members: string[];
    destinations: string[];
    owner: string;
  };
};

export async function readLimitConfig(connection: Connection, multisigPda: PublicKey, limitPda: PublicKey): Promise<OnChainLimit> {
  const [msInfo, limInfo] = await connection.getMultipleAccountsInfo([multisigPda, limitPda]);
  if (!msInfo) throw new Error("multisig account not found on chain");
  if (!limInfo) throw new Error("spending limit account not found on chain");
  const [ms] = multisig.accounts.Multisig.fromAccountInfo(msInfo);
  const [lim] = multisig.accounts.SpendingLimit.fromAccountInfo(limInfo);
  return {
    multisig: {
      configAuthority: ms.configAuthority.toBase58(),
      threshold: ms.threshold,
      members: ms.members.map((m) => m.key.toBase58()),
      owner: msInfo.owner.toBase58(),
    },
    limit: {
      multisig: lim.multisig.toBase58(),
      createKey: lim.createKey.toBase58(),
      vaultIndex: lim.vaultIndex,
      mint: lim.mint.toBase58(),
      amount: BigInt(lim.amount.toString()),
      period: lim.period,
      remainingAmount: BigInt(lim.remainingAmount.toString()),
      lastReset: BigInt(lim.lastReset.toString()),
      members: lim.members.map((k) => k.toBase58()),
      destinations: lim.destinations.map((k) => k.toBase58()),
      owner: limInfo.owner.toBase58(),
    },
  };
}

/**
 * Pure check that an on-chain vault is configured exactly as Orca promises. Returns a list of problems; an empty
 * list means the cap is real. Anything the user could have tampered with in the setup transaction is checked here,
 * because the transaction is signed in the user's browser and only the chain state can be trusted.
 */
export function verifyLimitConfig(
  cfg: OnChainLimit,
  expect: { owner: string; agent: string; multisigPda: string; limitPda: string; token?: TokenSpec; maxDailyUsdc: number },
): string[] {
  const token = args_token(expect.token);
  const problems: string[] = [];
  const program = SQUADS_PROGRAM_ID.toBase58();
  if (cfg.multisig.owner !== program) problems.push("multisig account is not owned by the Squads program");
  if (cfg.limit.owner !== program) problems.push("spending limit account is not owned by the Squads program");
  if (cfg.multisig.configAuthority !== expect.owner) problems.push("the vault is not controlled by your wallet");
  if (cfg.multisig.threshold !== 1) problems.push("vault threshold must be 1");
  if (cfg.multisig.members.length !== 1 || cfg.multisig.members[0] !== expect.owner) problems.push("only your wallet may be a vault member");
  if (cfg.multisig.members.includes(expect.agent)) problems.push("the agent must not be a vault member");
  if (cfg.limit.multisig !== expect.multisigPda) problems.push("spending limit belongs to a different vault");
  const [derived] = multisig.getSpendingLimitPda({ multisigPda: new PublicKey(expect.multisigPda), createKey: new PublicKey(cfg.limit.createKey) });
  if (derived.toBase58() !== expect.limitPda) problems.push("spending limit address does not match its vault");
  if (cfg.limit.vaultIndex !== 0) problems.push("limit must draw on vault 0");
  if (cfg.limit.mint !== token.mint.toBase58()) problems.push("limit is not in the expected token");
  if (cfg.limit.period !== Period.Day) problems.push("limit period must be one day");
  if (cfg.limit.members.length !== 1 || cfg.limit.members[0] !== expect.agent) problems.push("only the agent may use the limit");
  if (cfg.limit.destinations.length !== 1 || cfg.limit.destinations[0] !== expect.agent) problems.push("the limit may only pay the agent's own wallet");
  const max = toRaw(expect.maxDailyUsdc, token.decimals);
  if (cfg.limit.amount <= BigInt(0)) problems.push("daily limit must be above zero");
  if (cfg.limit.amount > max) problems.push("on-chain daily limit is higher than the amount you chose");
  return problems;
}

const args_token = (t?: TokenSpec) => t ?? USDC_TOKEN;

/** What the agent can still pull right now. The program resets a daily limit once a day has passed since `lastReset`. */
export function effectiveRemaining(limit: OnChainLimit["limit"], nowSec = BigInt(Math.floor(Date.now() / 1000))): bigint {
  return nowSec - limit.lastReset >= DAY_SECONDS ? limit.amount : limit.remainingAmount;
}

export const squadsAddresses = (multisigPda: PublicKey) => ({ vault: multisig.getVaultPda({ multisigPda, index: 0 })[0] });

/** The Squads fee receiver, which the program requires when creating a vault. */
export async function readTreasury(connection: Connection): Promise<PublicKey> {
  const [pda] = multisig.getProgramConfigPda({});
  const cfg = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, pda);
  return cfg.treasury;
}
