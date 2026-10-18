import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planPull } from "./vault";

const big = (n: number) => BigInt(Math.round(n * 1e6));

describe("planPull", () => {
  it("pulls nothing when the agent already holds enough", () => {
    assert.equal(planPull({ balance: 50, needed: 40, remainingRaw: big(100), vaultBalance: 500 }), 0);
  });
  it("pulls only the shortfall", () => {
    assert.equal(planPull({ balance: 10, needed: 40, remainingRaw: big(100), vaultBalance: 500 }), 30);
  });
  it("rounds the shortfall up to the token's smallest unit", () => {
    assert.equal(planPull({ balance: 0, needed: 1.0000004, remainingRaw: big(100), vaultBalance: 500 }), 1.000001);
  });
  it("fails closed when the daily limit cannot cover it", () => {
    assert.throws(() => planPull({ balance: 0, needed: 40, remainingRaw: big(25), vaultBalance: 500 }), /daily limit reached/);
  });
  it("fails closed when the vault is short", () => {
    assert.throws(() => planPull({ balance: 0, needed: 40, remainingRaw: big(100), vaultBalance: 10 }), /vault holds/);
  });
  it("allows pulling exactly the remaining limit", () => {
    assert.equal(planPull({ balance: 0, needed: 25, remainingRaw: big(25), vaultBalance: 500 }), 25);
  });
});
