import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

/** Returns the user's referral code, creating one on first use. */
export async function ensureReferralCode(user: User): Promise<string> {
  if (user.referralCode) return user.referralCode;
  const code = randomBytes(4).toString("hex");
  await db().update(users).set({ referralCode: code }).where(eq(users.id, user.id));
  return code;
}

/** Validates a referral code from a signup request; returns it only if it belongs to a real user. */
export async function resolveReferrer(code: unknown): Promise<string | null> {
  if (typeof code !== "string" || !/^[a-f0-9]{8}$/.test(code)) return null;
  const [row] = await db().select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1);
  return row ? code : null;
}
