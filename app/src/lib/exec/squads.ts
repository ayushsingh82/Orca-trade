import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
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

const toRaw = (usdc: number) => {
  if (!(usdc > 0) || !Number.isFinite(usdc)) throw new Error("amount must be a positive number");
  return BigInt(Math.round(usdc * 10 ** USDC.decimals));
};

export type VaultSetup = {
  instructions: TransactionInstruction[];
  /** Ephemeral keys that must co-sign this transaction (the user's wallet signs as creator/config authority). */
  extraSigners: Keypair[];
  multisigPda: PublicKey;
  vaultPda: PublicKey;
  spendingLimitPda: PublicKey;
};

/** Instructions for the user to sign: create a 1-of-1 vault they control, and add the agent's capped daily limit. */
export function buildVaultSetup(args: { creator: PublicKey; agentWallet: PublicKey; dailyUsdc: number; treasury: PublicKey }): VaultSetup {
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
    mint: new PublicKey(USDC.mint),
    amount: toRaw(args.dailyUsdc),
    period: Period.Day,
    members: [args.agentWallet],
    destinations: [args.agentWallet],
  });
  return { instructions: [create, addLimit], extraSigners: [createKey, limitKey], multisigPda, vaultPda, spendingLimitPda };
}

/** Instructions the agent signs to pull `usdc` from the vault into its own wallet, within the on-chain limit. */
export function buildTopUp(args: { multisigPda: PublicKey; spendingLimitPda: PublicKey; agentWallet: PublicKey; usdc: number }): TransactionInstruction[] {
  const mint = new PublicKey(USDC.mint);
  const raw = toRaw(args.usdc);
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
      decimals: USDC.decimals,
      destination: args.agentWallet,
      tokenProgram: TOKEN_PROGRAM_ID,
    }),
  ];
}

export const SQUADS_PROGRAM_ID = multisig.PROGRAM_ID;
