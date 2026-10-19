import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fmtPrice } from "./format";

describe("fmtPrice", () => {
  it("formats large and mid prices normally", () => {
    assert.equal(fmtPrice(82325.456), "$82,325.46");
    assert.equal(fmtPrice(104.571), "$104.57");
    assert.equal(fmtPrice(2.5), "$2.5");
    assert.equal(fmtPrice(0.2957), "$0.2957");
  });
  it("never rounds a small price to $0", () => {
    assert.equal(fmtPrice(0.0000029), "$0.00000290");
    assert.equal(fmtPrice(0.0004103), "$0.000410");
    assert.equal(fmtPrice(0.00445132), "$0.00445");
  });
  it("handles zero and bad input", () => {
    assert.equal(fmtPrice(0), "$0");
    assert.equal(fmtPrice(NaN), "—");
  });
});
