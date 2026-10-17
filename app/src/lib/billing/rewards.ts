import { eq } from "drizzle-orm";
import { db } from "@/db";
import { referralRewards, users } from "@/db/schema";

export const REFERRAL_REWARD_DAYS = 30;
/** Cap on rewards per referrer so referrals cannot be farmed into permanent free Pro. */
export const MAX_REWARDS_PER_REFERRER = 12;
const DAY = 86_400_000;

/**
 * Called when a user becomes a paying customer (Stripe or USDC). Gives their referrer 30 days of Pro, once
 * per referred user. Rewards only follow real payments, so fake sign-ups earn nothing.
 */
export async function grantReferralReward(referredUserId: string): Promise<void> {
  const [referred] = await db().select().from(users).where(eq(users.id, referredUserId)).limit(1);
  if (!referred?.referredBy) return;
  const [referrer] = await db().select().from(users).where(eq(users.referralCode, referred.referredBy)).limit(1);
  if (!referrer || referrer.id === referred.id) return;

  const given = await db().select({ id: referralRewards.id }).from(referralRewards).where(eq(referralRewards.referrerId, referrer.id));
  if (given.length >= MAX_REWARDS_PER_REFERRER) return;

  // Unique(referred_user_id) makes this idempotent: a second payment cannot reward twice.
  const inserted = await db()
    .insert(referralRewards)
    .values({ referrerId: referrer.id, referredUserId: referred.id, daysGranted: REFERRAL_REWARD_DAYS })
    .onConflictDoNothing()
    .returning({ id: referralRewards.id });
  if (inserted.length === 0) return;

  const base = referrer.bonusProUntil && referrer.bonusProUntil.getTime() > Date.now() ? referrer.bonusProUntil.getTime() : Date.now();
  await db()
    .update(users)
    .set({ bonusProUntil: new Date(base + REFERRAL_REWARD_DAYS * DAY) })
    .where(eq(users.id, referrer.id));
}
