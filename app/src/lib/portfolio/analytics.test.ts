import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocation, analyzeFills } from "./analytics";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

describe("analyzeFills", () => {
  it("with no fills the book is just the starting cash", () => {
    const s = analyzeFills(1000, [], {});
    assert.deepEqual([s.equityUsd, s.pnlUsd, s.trades, s.winRate], [1000, 0, 0, null]);
    assert.deepEqual(s.curve, [1000, 1000]);
  });
  it("marks an open position to the live price", () => {
    const s = analyzeFills(1000, [{ at: 1, asset: "SOL", units: 2, price: 100 }], { SOL: 110 });
    near(s.cashUsd, 800);
    near(s.equityUsd, 1020);
    near(s.pnlPct, 2);
    near(s.positions[0].unrealizedUsd, 20);
    near(s.positions[0].unrealizedPct, 10);
    near(s.realizedUsd, 0);
  });
  it("uses average cost across several buys", () => {
    const s = analyzeFills(1000, [{ at: 1, asset: "SOL", units: 1, price: 100 }, { at: 2, asset: "SOL", units: 1, price: 120 }], { SOL: 110 });
    near(s.positions[0].avgCost, 110);
    near(s.positions[0].unrealizedUsd, 0);
  });
  it("realizes PnL on a partial sell and keeps the rest at the same cost", () => {
    const s = analyzeFills(1000, [{ at: 1, asset: "SOL", units: 2, price: 100 }, { at: 2, asset: "SOL", units: -1, price: 130 }], { SOL: 130 });
    near(s.realizedUsd, 30);
    near(s.positions[0].units, 1);
    near(s.positions[0].avgCost, 100);
    near(s.equityUsd, 1060); // $30 realized + $30 unrealized
    assert.deepEqual([s.closedTrades, s.wins, s.winRate], [1, 1, 100]);
  });
  it("counts a losing close in the win rate", () => {
    const s = analyzeFills(1000, [
      { at: 1, asset: "SOL", units: 1, price: 100 }, { at: 2, asset: "SOL", units: -1, price: 90 },
      { at: 3, asset: "ETH", units: 1, price: 50 }, { at: 4, asset: "ETH", units: -1, price: 60 },
    ], {});
    near(s.realizedUsd, 0);
    assert.deepEqual([s.closedTrades, s.wins, s.winRate], [2, 1, 50]);
    assert.equal(s.positions.length, 0);
  });
  it("builds an equity curve from the prices it actually saw, ending at live prices", () => {
    const s = analyzeFills(1000, [{ at: 1, asset: "SOL", units: 2, price: 100 }, { at: 2, asset: "SOL", units: -2, price: 110 }], {});
    assert.equal(s.curve.length, 4);
    near(s.curve[1], 1000); // bought at the mark
    near(s.curve[2], 1020);
    near(s.curve[3], 1020);
  });
  it("sorts fills by time, so ledger order does not matter", () => {
    const s = analyzeFills(1000, [{ at: 2, asset: "SOL", units: -1, price: 120 }, { at: 1, asset: "SOL", units: 1, price: 100 }], {});
    near(s.realizedUsd, 20);
  });
});

describe("allocation", () => {
  it("returns percentages, largest first, dropping empty slices", () => {
    const a = allocation([{ label: "Cash", value: 600 }, { label: "SOL", value: 400 }, { label: "ETH", value: 0 }]);
    assert.deepEqual(a.map((x) => [x.label, Math.round(x.pct)]), [["Cash", 60], ["SOL", 40]]);
  });
  it("is empty when nothing is held", () => {
    assert.deepEqual(allocation([{ label: "Cash", value: 0 }]), []);
  });
});
