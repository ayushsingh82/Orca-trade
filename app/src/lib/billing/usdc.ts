import { Connection, Keypair, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { usdcPayments, users, type User } from "@/db/schema";
import { RPC_URL } from "@/lib/exec/config";
import { USDC } from "@/lib/exec/mints";
import { grantReferralReward } from "./rewards";

const DAY = 86_400_000;
export const PLAN_DAYS = 30;
const PAYMENT_WINDOW_MS = 60 * 60 * 1000;

export const USDC_PRICES: Record<"pro" | "teams", number> = {
  pro: Number(process.env.USDC_PRICE_PRO ?? 29),
  teams: Number(process.env.USDC_PRICE_TEAMS ?? 199),
};

const treasury = () => {
  const t = process.env.TREASURY_WALLET;
  if (!t) throw new Error("USDC payments are not configured (missing TREASURY_WALLET)");
  return t;
};

/**
 * Pure: did this confirmed transaction deliver at least `minAmount` USDC to `treasuryOwner`?
 * Reads the treasury's USDC balance change, so it works regardless of which token account was used.
 */
export function checkUsdcTransfer(tx: ParsedTransactionWithMeta, args: { treasuryOwner: string; mint: string; minAmount: number }): boolean {
  if (!tx.meta || tx.meta.err) return false;
  const sum = (rows: typeof tx.meta.postTokenBalances) =>
    (rows ?? [])
      .filter((b) => b.owner === args.treasuryOwner && b.mint === args.mint)
      .reduce((s, b) => s + Number(b.uiTokenAmount.uiAmountString ?? 0), 0);
  const received = sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances);
  return received + 1e-9 >= args.minAmount;
}

export async function startUsdcPayment(user: User, plan: "pro" | "teams") {
  const recipient = treasury();
  if (user.stripeSubscriptionId) throw new Error("You have an active card subscription. Manage it from the billing portal.");
  const reference = Keypair.generate().publicKey.toBase58();
  const amount = USDC_PRICES[plan];
  const [row] = await db()
    .insert(usdcPayments)
    .values({ userId: user.id, plan, amountUsdc: amount, reference, expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MS) })
    .returning();
  const payUrl = `solana:${recipient}?amount=${amount}&spl-token=${USDC.mint}&reference=${reference}&label=Orca&message=${encodeURIComponent(`Orca ${plan} plan`)}`;
  return { id: row.id, recipient, amount, mint: USDC.mint, reference, payUrl, expiresAt: row.expiresAt };
}

/** Looks for a confirmed transfer carrying this payment's reference. If found, activates the plan once. */
export async function verifyUsdcPayment(user: User, paymentId: string): Promise<{ paid: boolean; signature?: string }> {
  const [payment] = await db()
    .select()
    .from(usdcPayments)
    .where(and(eq(usdcPayments.id, paymentId), eq(usdcPayments.userId, user.id)))
    .limit(1);
  if (!payment) throw new Error("payment not found");
  if (payment.status === "paid") return { paid: true, signature: payment.signature ?? undefined };
  if (payment.expiresAt.getTime() < Date.now()) {
    await db().update(usdcPayments).set({ status: "expired" }).where(eq(usdcPayments.id, payment.id));
    throw new Error("payment window expired; start a new payment");
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const { PublicKey } = await import("@solana/web3.js");
  const sigs = await connection.getSignaturesForAddress(new PublicKey(payment.reference), { limit: 10 }, "confirmed");
  for (const { signature, err } of sigs) {
    if (err) continue;
    const tx = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx || (tx.blockTime ?? 0) * 1000 < payment.createdAt.getTime() - 60_000) continue;
    if (!checkUsdcTransfer(tx, { treasuryOwner: treasury(), mint: USDC.mint, minAmount: payment.amountUsdc })) continue;

    // Unique(signature) + the status guard make activation single-use even if verify is called twice.
    const claimed = await db()
      .update(usdcPayments)
      .set({ status: "paid", signature })
      .where(and(eq(usdcPayments.id, payment.id), eq(usdcPayments.status, "pending")))
      .returning({ id: usdcPayments.id });
    if (claimed.length === 0) return { paid: true, signature };

    const base = user.planExpiresAt && user.planExpiresAt.getTime() > Date.now() && user.plan === payment.plan ? user.planExpiresAt.getTime() : Date.now();
    await db()
      .update(users)
      .set({ plan: payment.plan, planExpiresAt: new Date(base + PLAN_DAYS * DAY) })
      .where(eq(users.id, user.id));
    await grantReferralReward(user.id);
    return { paid: true, signature };
  }
  return { paid: false };
}
