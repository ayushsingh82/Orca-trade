import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertQuoteSane } from "./pricing";

const base = { referencePrice: 100, maxSlippageBps: 50, toleranceBps: 150 }; // allowed band: 200bps

describe("assertQuoteSane", () => {
  it("accepts quotes within the band", () => {
    assert.doesNotThrow(() => assertQuoteSane({ ...base, side: "buy", impliedPrice: 101.9 }));
    assert.doesNotThrow(() => assertQuoteSane({ ...base, side: "sell", impliedPrice: 98.1 }));
  });
  it("rejects a buy that pays too much", () => {
    assert.throws(() => assertQuoteSane({ ...base, side: "buy", impliedPrice: 102.5 }), /worse than reference/);
  });
  it("rejects a sell that receives too little", () => {
    assert.throws(() => assertQuoteSane({ ...base, side: "sell", impliedPrice: 97.5 }), /worse than reference/);
  });
  it("does not penalise favourable deviation", () => {
    assert.doesNotThrow(() => assertQuoteSane({ ...base, side: "buy", impliedPrice: 90 }));
    assert.doesNotThrow(() => assertQuoteSane({ ...base, side: "sell", impliedPrice: 110 }));
  });
  it("fails closed on missing or invalid prices", () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      assert.throws(() => assertQuoteSane({ ...base, side: "buy", impliedPrice: 100, referencePrice: bad }), /reference/);
      assert.throws(() => assertQuoteSane({ ...base, side: "buy", impliedPrice: bad }), /valid price/);
    }
  });
});
