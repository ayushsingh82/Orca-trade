// Trend signals for the tradable tokens beyond the news-covered majors. They use the same 7d/14d trend scoring as
// the main signals, but there is no news data for these tokens, so they never carry citations or contradictions.
import { tokenByCgId, TRADABLE, type TradableToken } from "@/lib/exec/mints";
import { getMarketsByIds, type MarketRow } from "@/lib/tokens/markets";
import { convictionFrom, scoreSignal } from "./scoring";
import type { OrcaSignal } from "./signals";

/** High-risk tokens (memecoins) can never rank above this, however strong the trend looks. */
export const HIGH_RISK_CONVICTION_CAP = 65;

/** Pure: a trend-only signal for one token, or null when 7d/14d data is missing (fails closed). */
export function buildTrendSignal(row: MarketRow, token: TradableToken): OrcaSignal | null {
  const scored = scoreSignal({ return7dPct: row.change7d, return14dPct: row.change14d, newsBias: 0 });
  if (!scored) return null;
  let conviction = convictionFrom({ score: scored.score, direction: scored.direction, headlines: 0, worstSeverity: 0 });
  const high = token.risk === "high";
  if (high) conviction = Math.min(conviction, HIGH_RISK_CONVICTION_CAP);
  const sign = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  return {
    id: `sig_${token.symbol.toLowerCase()}`,
    asset: token.symbol,
    direction: scored.direction,
    conviction,
    price: row.price,
    change24h: Math.round((row.change24h ?? 0) * 100) / 100,
    rationale: [
      `${sign(row.change7d as number)} over 7d, ${sign(row.change14d as number)} over 14d (${sign(row.change24h ?? 0)} 24h)`,
      "Trend only: no news coverage for this token",
      ...(high ? ["High-risk token: very volatile, conviction is capped"] : []),
    ],
    citations: [],
    contradictions: [],
    riskFlag: high ? "medium" : "none",
  };
}

/** Trend signals for every tradable token not already covered by `covered`. One market-data call. */
export async function buildExtendedSignals(covered: Set<string>): Promise<OrcaSignal[]> {
  const todo = TRADABLE.filter((t) => !covered.has(t.symbol));
  if (todo.length === 0) return [];
  const rows = await getMarketsByIds(todo.map((t) => t.cgId));
  return rows.flatMap((r) => {
    const token = tokenByCgId(r.id);
    const s = token ? buildTrendSignal(r, token) : null;
    return s ? [s] : [];
  });
}
