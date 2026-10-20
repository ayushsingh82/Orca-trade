import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSentiment, type SentimentInputs } from "./sentiment";

const all: SentimentInputs = {
  breadth: { total: 40, up24h: 30, up7d: 28 },
  news: { bullish: 6, bearish: 1, neutral: 3 },
  sectors: { total: 10, up: 8 },
  flow: { ratios: [0.65, 0.6] },
};

describe("computeSentiment", () => {
  it("is risk-on when every input is positive", () => {
    const s = computeSentiment(all)!;
    assert.equal(s.label, "Risk-on");
    assert.ok(s.score >= 20);
    assert.equal(s.used, 4);
    assert.equal(s.confidence, "high");
  });
  it("is risk-off when every input is negative", () => {
    const s = computeSentiment({ breadth: { total: 40, up24h: 6, up7d: 8 }, news: { bullish: 1, bearish: 7, neutral: 2 }, sectors: { total: 10, up: 2 }, flow: { ratios: [0.35, 0.4] } })!;
    assert.equal(s.label, "Risk-off");
    assert.ok(s.score <= -20);
  });
  it("is mixed when the signals disagree", () => {
    const s = computeSentiment({ breadth: { total: 40, up24h: 30, up7d: 30 }, news: { bullish: 1, bearish: 6, neutral: 3 }, sectors: { total: 10, up: 5 }, flow: { ratios: [0.5] } })!;
    assert.equal(s.label, "Mixed");
  });
  it("leaves missing inputs out and rescales, with lower confidence", () => {
    const s = computeSentiment({ ...all, news: null })!;
    assert.equal(s.used, 3);
    assert.equal(s.confidence, "medium");
    assert.ok(!s.components.some((c) => c.key === "news"));
    assert.ok(s.score >= 20); // still clearly positive: weights were rescaled, not zero-filled
  });
  it("refuses to give a reading from fewer than two inputs", () => {
    assert.equal(computeSentiment({ breadth: all.breadth, news: null, sectors: null, flow: null }), null);
    assert.equal(computeSentiment({ breadth: null, news: null, sectors: null, flow: null }), null);
  });
  it("ignores inputs with too little data to mean anything", () => {
    const s = computeSentiment({ breadth: { total: 5, up24h: 5, up7d: 5 }, news: { bullish: 1, bearish: 0, neutral: 0 }, sectors: { total: 2, up: 2 }, flow: { ratios: [0.7] } });
    assert.equal(s, null); // only order flow qualified
  });
  it("keeps the score within -100..100", () => {
    const hi = computeSentiment({ breadth: { total: 40, up24h: 40, up7d: 40 }, news: { bullish: 10, bearish: 0, neutral: 0 }, sectors: { total: 10, up: 10 }, flow: { ratios: [1] } })!;
    assert.equal(hi.score, 100);
    const lo = computeSentiment({ breadth: { total: 40, up24h: 0, up7d: 0 }, news: { bullish: 0, bearish: 10, neutral: 0 }, sectors: { total: 10, up: 0 }, flow: { ratios: [0] } })!;
    assert.equal(lo.score, -100);
  });
});
