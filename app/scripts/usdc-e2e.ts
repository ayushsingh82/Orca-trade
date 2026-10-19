/**
 * End-to-end check of USDC subscription payments: real SPL transfers on a local chain that has the real USDC
 * mint cloned from mainnet, verified by the real verifier against a local Postgres.
 *
 *   1. npx tsx scripts/usdc-e2e-prep.ts          (writes a funded payer token account + keys)
 *   2. solana-test-validator --reset --url mainnet-beta \
 *        --clone EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
 *        --account <payerAta printed by step 1> /tmp/orca-usdc-e2e/payer-ata.json
 *   3. DATABASE_URL=postgresql://...@127.0.0.1:5432/orca TREASURY_WALLET=<treasury printed by step 1> \
 *        SOLANA_RPC_URL=http://127.0.0.1:8899 npx tsx scripts/usdc-e2e.ts
 */
import { readFileSync } from "node:fs";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usdcPayments, users } from "@/db/schema";
import { startUsdcPayment, verifyUsdcPayment } from "@/lib/billing/usdc";

const keys = JSON.parse(readFileSync("/tmp/orca-usdc-e2e/keys.json", "utf8"));
const payer = Keypair.fromSecretKey(Uint8Array.from(keys.payer));
const treasury = new PublicKey(keys.treasury);
const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
let fails = 0;
const ok = (n: string, c: boolean, x = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  (" + x + ")" : ""}`); if (!c) fails++; };

async function pay(reference: string, usdc: number) {
  const from = getAssociatedTokenAddressSync(MINT, payer.publicKey);
  const to = getAssociatedTokenAddressSync(MINT, treasury);
  const ix = createTransferCheckedInstruction(from, MINT, to, payer.publicKey, Math.round(usdc * 1e6), 6);
  ix.keys.push({ pubkey: new PublicKey(reference), isSigner: false, isWritable: false }); // Solana Pay reference
  const tx = new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, to, treasury, MINT), ix);
  return sendAndConfirmTransaction(connection, tx, [payer]);
}

(async () => {
  await connection.confirmTransaction(await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL), "confirmed");
  const [user] = await db().insert(users).values({ email: `usdc-${Date.now()}@it.test`, referralCode: Math.random().toString(36).slice(2, 10) }).returning();
  const other = await db().insert(users).values({ email: `usdc2-${Date.now()}@it.test`, referralCode: Math.random().toString(36).slice(2, 10) }).returning().then((r) => r[0]);

  const p = await startUsdcPayment(user, "pro");
  ok("payment created for 29 USDC", p.amount === 29 && p.recipient === keys.treasury);
  ok("nothing paid yet -> not paid", (await verifyUsdcPayment(user, p.id)).paid === false);

  await pay(p.reference, 10);
  ok("underpayment (10 USDC) is not accepted", (await verifyUsdcPayment(user, p.id)).paid === false);
  ok("plan unchanged after underpayment", (await db().select().from(users).where(eq(users.id, user.id)))[0].plan === "free");

  let thrown = "";
  try { await verifyUsdcPayment(other, p.id); } catch (e) { thrown = (e as Error).message; }
  ok("another user cannot claim this payment", /not found/.test(thrown), thrown);

  const sig = await pay(p.reference, 29);
  const r = await verifyUsdcPayment(user, p.id);
  ok("exact payment accepted", r.paid === true && r.signature === sig, r.signature?.slice(0, 8));
  const [after] = await db().select().from(users).where(eq(users.id, user.id));
  const days = ((after.planExpiresAt?.getTime() ?? 0) - Date.now()) / 86_400_000;
  ok("plan set to pro for 30 days", after.plan === "pro" && days > 29.9 && days <= 30, `${days.toFixed(2)} days`);

  const r2 = await verifyUsdcPayment({ ...after }, p.id);
  const [after2] = await db().select().from(users).where(eq(users.id, user.id));
  ok("verifying twice does not extend the plan", r2.paid && after2.planExpiresAt?.getTime() === after.planExpiresAt?.getTime());

  // The same on-chain transfer must not pay for a second purchase.
  const p2 = await startUsdcPayment(after2, "pro");
  ok("a new reference is not satisfied by the old transfer", (await verifyUsdcPayment(after2, p2.id)).paid === false);

  // Expired payments are refused.
  const p3 = await startUsdcPayment(after2, "teams");
  await db().update(usdcPayments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(usdcPayments.id, p3.id));
  let exp = ""; try { await verifyUsdcPayment(after2, p3.id); } catch (e) { exp = (e as Error).message; }
  ok("expired payment is refused", /expired/.test(exp), exp);

  for (const id of [user.id, other.id]) await db().delete(users).where(eq(users.id, id));
  console.log(fails === 0 ? "\nALL USDC CHECKS PASSED" : `\n${fails} FAILED`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("script error:", e); process.exit(2); });
