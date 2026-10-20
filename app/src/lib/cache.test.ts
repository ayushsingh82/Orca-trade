import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memo } from "./cache";

describe("memo", () => {
  it("returns the cached value within the ttl and recomputes after it", async () => {
    let t = 0;
    let calls = 0;
    const fn = async () => ++calls;
    const key = `k-${Math.random()}`;
    assert.equal(await memo(key, 100, fn, () => t), 1);
    t = 50;
    assert.equal(await memo(key, 100, fn, () => t), 1);
    t = 150;
    assert.equal(await memo(key, 100, fn, () => t), 2);
  });
  it("shares one in-flight call between concurrent callers", async () => {
    let calls = 0;
    const key = `k-${Math.random()}`;
    const slow = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return "x";
    };
    const out = await Promise.all([memo(key, 1000, slow), memo(key, 1000, slow), memo(key, 1000, slow)]);
    assert.deepEqual(out, ["x", "x", "x"]);
    assert.equal(calls, 1);
  });
  it("serves the last good value when a refresh fails, but throws when there is none", async () => {
    let t = 0;
    const key = `k-${Math.random()}`;
    assert.equal(await memo(key, 10, async () => "good", () => t), "good");
    t = 100;
    assert.equal(await memo(key, 10, async () => { throw new Error("down"); }, () => t), "good");
    await assert.rejects(() => memo(`k-${Math.random()}`, 10, async () => { throw new Error("down"); }), /down/);
  });
});
