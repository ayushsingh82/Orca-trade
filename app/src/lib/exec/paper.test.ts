import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paperPortfolio } from "./paper";

const buy = (asset: string, usd: number, units: number) => ({
  proposal: { asset, side: "buy" as const, sizeUsd: usd }, status: "paper", fillUnits: units, fillPrice: usd / units,
});
const sell = (asset: string, usd: number, units: number) => ({
  proposal: { asset, side: "sell" as const, sizeUsd: usd }, status: "paper", fillUnits: -units, fillPrice: usd / units,
});

describe("paperPortfolio", () => {
  it("starts flat at the starting balance", () => {
    const p = paperPortfolio(1000, [], {});
    assert.deepEqual([p.totalUsd, p.pnlUsd, p.cashUsd], [1000, 0, 1000]);
  });
  it("marks a buy to market", () => {
    const p = paperPortfolio(1000, [buy("SOL", 100, 1)], { SOL: 110 }); // bought 1 SOL at $100, now $110
    assert.equal(p.cashUsd, 900);
    assert.equal(p.positionsUsd.SOL, 110);
    assert.equal(p.pnlUsd, 10);
  });
  it("realises PnL on a round trip", () => {
    const p = paperPortfolio(1000, [buy("SOL", 100, 1), sell("SOL", 120, 1)], { SOL: 999 });
    assert.equal(p.cashUsd, 1020);
    assert.equal(p.units.SOL, 0);
    assert.equal(p.pnlUsd, 20);
  });
  it("ignores decisions that were not paper fills", () => {
    const p = paperPortfolio(1000, [{ ...buy("SOL", 100, 1), status: "rejected" }, { proposal: null, status: "logged", fillUnits: null, fillPrice: null }], { SOL: 100 });
    assert.equal(p.totalUsd, 1000);
  });
});
