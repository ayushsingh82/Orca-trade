import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to max, then blocks with a retry time", () => {
    const k = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) assert.equal(rateLimit(k, 3, 60_000, 1_000 + i).allowed, true);
    const blocked = rateLimit(k, 3, 60_000, 1_010);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSec >= 59 && blocked.retryAfterSec <= 60);
  });
  it("lets requests through again once the window has passed", () => {
    const k = `t-${Math.random()}`;
    for (let i = 0; i < 2; i++) rateLimit(k, 2, 1_000, 0);
    assert.equal(rateLimit(k, 2, 1_000, 500).allowed, false);
    assert.equal(rateLimit(k, 2, 1_000, 1_001).allowed, true);
  });
  it("keeps keys independent", () => {
    const a = `a-${Math.random()}`;
    rateLimit(a, 1, 60_000, 0);
    assert.equal(rateLimit(a, 1, 60_000, 1).allowed, false);
    assert.equal(rateLimit(`b-${Math.random()}`, 1, 60_000, 1).allowed, true);
  });
});
