// Backtest of Orca's price-momentum signal on SoSoValue daily candles.
// Run: set -a; . ./.env.local; set +a; SOSO_KLINES_LIVE=1 npx tsx scripts/backtest.ts
// Limits: the Demo plan returns ~90 daily candles per asset, so samples are small. News bias has no
// history, so only the price component of the score can be tested.
import { getKlines } from "../src/lib/intel/sosovalue";

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP"];
const COST = 0.001; // 10 bps per position change, one way

type Series = { asset: string; close: number[] };

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1));
};

type Rule = { name: string; dir: (s: Series, t: number) => -1 | 0 | 1 };
const lookback = (n: number, thresh: number, sign: 1 | -1): Rule["dir"] => (s, t) => {
  if (t < n) return 0;
  const r = s.close[t] / s.close[t - n] - 1;
  return r > thresh ? (sign as 1 | -1) : r < -thresh ? ((-sign) as 1 | -1) : 0;
};

const RULES: Rule[] = [
  { name: "current: 1d momentum, 1% threshold", dir: lookback(1, 0.01, 1) },
  { name: "1d momentum, 0% threshold", dir: lookback(1, 0, 1) },
  { name: "3d momentum, 2%", dir: lookback(3, 0.02, 1) },
  { name: "7d momentum, 3%", dir: lookback(7, 0.03, 1) },
  { name: "14d momentum, 5%", dir: lookback(14, 0.05, 1) },
  { name: "1d reversal, 1%", dir: lookback(1, 0.01, -1) },
  { name: "3d reversal, 2%", dir: lookback(3, 0.02, -1) },
  { name: "buy & hold (baseline)", dir: () => 1 },
];

(async () => {
  const series: Series[] = [];
  for (const asset of ASSETS) {
    const { data } = await getKlines(asset, "1d", 90);
    const close = data.sort((a, b) => a.t - b.t).map((k) => k.c);
    series.push({ asset, close });
  }
  console.log(`Assets: ${series.map((s) => `${s.asset}(${s.close.length}d)`).join(" ")}\n`);
  console.log("rule".padEnd(38), "trades", "hit%".padStart(6), "avg/trade%".padStart(11), "t-stat".padStart(7), "net avg%".padStart(9));

  for (const rule of RULES) {
    const pnl: number[] = [];
    let hits = 0;
    for (const s of series) {
      let prev = 0;
      for (let t = 0; t < s.close.length - 1; t++) {
        const d = rule.dir(s, t);
        const fwd = s.close[t + 1] / s.close[t] - 1;
        if (d !== 0) {
          const cost = d !== prev ? COST : 0;
          pnl.push(d * fwd - cost);
          if (d * fwd > 0) hits++;
        }
        prev = d;
      }
    }
    const n = pnl.length;
    const m = mean(pnl);
    const t = n > 1 ? m / (sd(pnl) / Math.sqrt(n)) : NaN;
    console.log(
      rule.name.padEnd(38),
      String(n).padStart(6),
      ((hits / n) * 100).toFixed(1).padStart(6),
      (m * 100).toFixed(3).padStart(11),
      t.toFixed(2).padStart(7),
      (m * 100).toFixed(3).padStart(9),
    );
  }
  console.log("\n|t| > 2 is roughly 'unlikely to be luck'. With ~450 daily observations, small edges cannot be detected.");
})();
