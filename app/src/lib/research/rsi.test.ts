import assert from "node:assert/strict";
import { test } from "node:test";
import { resample, rsi, rsiSeries, zone } from "./rsi";

test("rsi is 100 for a rising series, 0 for a falling one, 50 for a flat one", () => {
  const up = Array.from({ length: 30 }, (_, i) => 100 + i);
  assert.equal(rsi(up), 100);
  assert.equal(rsi([...up].reverse()), 0);
  assert.equal(rsi(Array(30).fill(10)), 50);
});

test("rsi needs period + 1 closes", () => {
  assert.equal(rsi(Array.from({ length: 14 }, (_, i) => i)), null);
  assert.notEqual(rsi(Array.from({ length: 15 }, (_, i) => i * (i % 2 ? 1 : 2))), null);
});

test("rsi matches an independent Wilder calculation", () => {
  const c = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46, 46.03, 46.41, 46.22, 45.64];
  // Reference: textbook Wilder smoothing, written out longhand.
  let ag = 0;
  let al = 0;
  for (let i = 1; i <= 14; i++) {
    const d = c[i] - c[i - 1];
    ag += Math.max(d, 0);
    al += Math.max(-d, 0);
  }
  ag /= 14;
  al /= 14;
  const first = 100 - 100 / (1 + ag / al);
  assert.ok(Math.abs(rsiSeries(c)[0] - first) < 1e-9);
  assert.ok(Math.abs(first - 70.53) < 0.1); // the published StockCharts value for this dataset
  for (let i = 15; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    ag = (ag * 13 + Math.max(d, 0)) / 14;
    al = (al * 13 + Math.max(-d, 0)) / 14;
  }
  assert.ok(Math.abs(rsi(c)! - (100 - 100 / (1 + ag / al))) < 1e-9);
});

test("resample keeps the last price per bucket", () => {
  const pts = [
    { t: 0, p: 1 },
    { t: 10, p: 2 },
    { t: 100, p: 3 },
    { t: 150, p: 4 },
    { t: 250, p: 5 },
  ];
  assert.deepEqual(resample(pts, 100), [2, 4, 5]);
});

test("zones", () => {
  assert.equal(zone(25), "oversold");
  assert.equal(zone(80), "overbought");
  assert.equal(zone(50), "neutral");
  assert.equal(zone(40), "weak");
  assert.equal(zone(60), "strong");
});
