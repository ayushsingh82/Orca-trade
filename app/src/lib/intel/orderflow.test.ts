import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeOrderFlow } from "./orderflow";

const book = { bids: [["100", "3", 1], ["99", "1", 1]] as [string, string, number][], asks: [["101", "1", 1], ["102", "1", 1]] as [string, string, number][] };
const trade = (side: "buy" | "sell", size: string) => ({ trade_id: 1, side, size, price: "100", time: "2026-01-01T00:00:00Z" });

describe("computeOrderFlow", () => {
  it("measures spread and depth imbalance from the book", () => {
    const f = computeOrderFlow("BTC", book, [trade("sell", "1")]);
    assert.equal(f.spreadBps, 99.5);
    assert.equal(f.depthImbalance, 0.333); // bids 4 vs asks 2
  });
  it("treats a maker 'sell' as a buyer taking liquidity", () => {
    const f = computeOrderFlow("BTC", book, [trade("sell", "3"), trade("buy", "1")]);
    assert.equal(f.takerBuyRatio, 0.75);
    assert.equal(f.netFlowUsd, 200);
  });
  it("refuses an empty book instead of inventing numbers", () => {
    assert.throws(() => computeOrderFlow("BTC", { bids: [], asks: [] }, []), /empty order book/);
  });
});
