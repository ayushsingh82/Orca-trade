import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectivePlan } from "./effective-plan";

const now = 1_000_000;
const at = (ms: number | null) => (ms === null ? null : new Date(ms));
const u = (plan: "free" | "pro" | "teams", planExpiresAt: number | null = null, bonusProUntil: number | null = null) => ({
  plan, planExpiresAt: at(planExpiresAt), bonusProUntil: at(bonusProUntil),
});

describe("effectivePlan", () => {
  it("returns the stored plan when nothing expires", () => assert.equal(effectivePlan(u("pro"), now), "pro"));
  it("lapses an expired USDC plan to free", () => {
    assert.equal(effectivePlan(u("pro", now - 1), now), "free");
    assert.equal(effectivePlan(u("pro", now), now), "free"); // boundary: expired at exactly now
    assert.equal(effectivePlan(u("pro", now + 1), now), "pro");
  });
  it("referral bonus lifts free to pro until it ends", () => {
    assert.equal(effectivePlan(u("free", null, now + 1), now), "pro");
    assert.equal(effectivePlan(u("free", null, now), now), "free");
  });
  it("bonus never downgrades a higher plan", () => {
    assert.equal(effectivePlan(u("teams", null, now + 1000), now), "teams");
  });
  it("an expired paid plan still gets the bonus", () => {
    assert.equal(effectivePlan(u("teams", now - 1, now + 1000), now), "pro");
  });
});
