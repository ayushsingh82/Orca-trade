/**
 * Integration tests against a real Postgres. They run only when DATABASE_URL points at a local database
 * (localhost / 127.0.0.1) so they can never touch production. Run: npm run test:db
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { referralRewards, users } from "@/db/schema";
import { grantReferralReward, MAX_REWARDS_PER_REFERRER, REFERRAL_REWARD_DAYS } from "@/lib/billing/rewards";
import { consume, refund, used } from "@/lib/entitlements";

const local = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
const created: string[] = [];

async function makeUser(over: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db()
    .insert(users)
    .values({ email: `${randomUUID()}@it.test`, referralCode: randomUUID().slice(0, 8), ...over })
    .returning();
  created.push(u.id);
  return u;
}

describe("db integration", { skip: !local && "needs a local DATABASE_URL" }, () => {
  after(async () => {
    for (const id of created) await db().delete(users).where(eq(users.id, id));
  });

  it("free plan allows exactly 5 Ask per day, then refuses", async () => {
    const u = await makeUser();
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await consume(u, "ask")).allowed);
    assert.deepEqual(results, [true, true, true, true, true, false, false]);
    assert.equal(await used(u.id, "ask"), 5);
  });

  it("is race-safe: 20 parallel requests are allowed exactly 5 times", async () => {
    const u = await makeUser();
    const results = await Promise.all(Array.from({ length: 20 }, () => consume(u, "ask")));
    assert.equal(results.filter((r) => r.allowed).length, 5);
    assert.equal(await used(u.id, "ask"), 5);
  });

  it("refund gives a unit back and never goes below zero", async () => {
    const u = await makeUser();
    await consume(u, "ask");
    await refund(u, "ask");
    assert.equal(await used(u.id, "ask"), 0);
    await refund(u, "ask");
    assert.equal(await used(u.id, "ask"), 0);
    assert.equal((await consume(u, "ask")).allowed, true);
  });

  it("teams is unlimited and records nothing", async () => {
    const u = await makeUser({ plan: "teams" });
    for (let i = 0; i < 3; i++) assert.equal((await consume(u, "ask")).allowed, true);
    assert.equal(await used(u.id, "ask"), 0);
  });

  it("referral reward: 30 days of Pro, once per referred user", async () => {
    const referrer = await makeUser();
    const friend = await makeUser({ referredBy: referrer.referralCode });
    await grantReferralReward(friend.id);
    await grantReferralReward(friend.id); // a second payment must not reward twice
    const [after1] = await db().select().from(users).where(eq(users.id, referrer.id));
    const days = ((after1.bonusProUntil?.getTime() ?? 0) - Date.now()) / 86_400_000;
    assert.ok(days > REFERRAL_REWARD_DAYS - 0.1 && days <= REFERRAL_REWARD_DAYS, `got ${days} days`);
    const rows = await db().select().from(referralRewards).where(eq(referralRewards.referrerId, referrer.id));
    assert.equal(rows.length, 1);
  });

  it("referral rewards stack on top of an active reward", async () => {
    const referrer = await makeUser();
    for (let i = 0; i < 2; i++) {
      const f = await makeUser({ referredBy: referrer.referralCode });
      await grantReferralReward(f.id);
    }
    const [r] = await db().select().from(users).where(eq(users.id, referrer.id));
    const days = ((r.bonusProUntil?.getTime() ?? 0) - Date.now()) / 86_400_000;
    assert.ok(days > 2 * REFERRAL_REWARD_DAYS - 0.1);
  });

  it("referral rewards are capped per referrer", async () => {
    const referrer = await makeUser();
    for (let i = 0; i < MAX_REWARDS_PER_REFERRER + 3; i++) {
      const f = await makeUser({ referredBy: referrer.referralCode });
      await grantReferralReward(f.id);
    }
    const rows = await db().select().from(referralRewards).where(eq(referralRewards.referrerId, referrer.id));
    assert.equal(rows.length, MAX_REWARDS_PER_REFERRER);
  });

  it("a user cannot refer themselves", async () => {
    const u = await makeUser();
    await db().update(users).set({ referredBy: u.referralCode }).where(eq(users.id, u.id));
    await grantReferralReward(u.id);
    const rows = await db().select().from(referralRewards).where(eq(referralRewards.referrerId, u.id));
    assert.equal(rows.length, 0);
  });
});
