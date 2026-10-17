import { clamp } from "@/lib/intel/analytics";

/**
 * Directional score for a signal, in -100..100.
 *
 * Backtest (scripts/backtest.ts, 5 assets x ~90 daily candles): 1-day momentum, the original driver, had
 * a 38.6% hit rate and a negative average return, while 7- and 14-day trend were the only price rules with
 * a positive average. Samples are small and not statistically significant, so this is a modest
 * re-weighting, not proof of an edge: 24h change no longer drives direction, trend does.
 */
export const SCORE_WEIGHTS = { trend7d: 0.35, trend14d: 0.35, news: 0.3 } as const;
/** Scales a return (in %) so the backtested thresholds (7d 3%, 14d 5%) both land near score 20. */
const SCALE_7D = 6.7;
const SCALE_14D = 4;
export const DIRECTION_THRESHOLD = 15;

export type ScoreInput = {
  /** 7 and 14 day returns in percent, or null when trend data is unavailable. */
  return7dPct: number | null;
  return14dPct: number | null;
  /** News bias in about -100..100 (bullish minus bearish conviction, averaged). */
  newsBias: number;
};

export function scoreSignal(i: ScoreInput) {
  if (i.return7dPct === null || i.return14dPct === null) return null; // fail closed: no trend, no signal
  const trend7 = clamp(i.return7dPct * SCALE_7D, -100, 100);
  const trend14 = clamp(i.return14dPct * SCALE_14D, -100, 100);
  const score = clamp(
    trend7 * SCORE_WEIGHTS.trend7d + trend14 * SCORE_WEIGHTS.trend14d + clamp(i.newsBias, -100, 100) * SCORE_WEIGHTS.news,
    -100,
    100,
  );
  const direction = score > DIRECTION_THRESHOLD ? "long" : score < -DIRECTION_THRESHOLD ? "short" : "neutral";
  return { score, direction } as const;
}

/**
 * Conviction is a relative ranking of how strong and well-supported a signal is, not a probability of
 * profit. Headlines add a little, contradictions subtract, and it is capped at 85 because no rule has
 * shown a significant edge yet.
 */
export function convictionFrom(args: { score: number; direction: "long" | "short" | "neutral"; headlines: number; worstSeverity: number }) {
  const base = Math.abs(args.score) + (args.direction === "neutral" ? 0 : args.headlines * 4);
  return Math.round(clamp(base - args.worstSeverity * 6, 5, 85));
}
