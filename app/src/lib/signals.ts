// OrcaSignal: the contract between the Intelligence layer and the Agent runtime.
// Evolved from MarketMind's `marketmind.autofund.signal/v1` handoff payload.
import { buildLiveNewsImpacts, detectContradictions } from "./intel/marketmind";
import { buildMarketMindIndex } from "./intel/ssi";
import { getKlines } from "./intel/sosovalue";
import { convictionFrom, scoreSignal } from "./scoring";
import type { Contradiction } from "./intel/types";
import { buildExtendedSignals } from "./signals-extended";

export type OrcaSignal = {
  id: string;
  asset: string;
  direction: "long" | "short" | "neutral";
  conviction: number; // 0..100
  price: number;
  change24h: number;
  rationale: string[];
  citations: { id: string; title: string; source: string }[];
  contradictions: Contradiction[];
  /** Highest contradiction severity touching this signal; agents downgrade on "high". */
  riskFlag: "none" | "low" | "medium" | "high";
};

export type SignalsResult = {
  signals: OrcaSignal[];
  generatedAt: number;
  source: string;
};

const SEVERITY_RANK = { low: 1, medium: 2, high: 3 } as const;

export async function buildSignals(): Promise<SignalsResult> {
  // Same news limit as detectContradictions so both share one cached SoSoValue call.
  const [index, news, contra] = await Promise.all([
    buildMarketMindIndex(),
    buildLiveNewsImpacts(10),
    detectContradictions(),
  ]);

  // Daily closes for the 7d/14d trend (cached 6h). Missing data means no signal for that asset.
  const closes = new Map<string, number[]>();
  await Promise.all(
    index.constituents.map(async (c) => {
      try {
        const { data } = await getKlines(c.symbol, "1d", 30);
        closes.set(c.symbol, data.sort((a, b) => a.t - b.t).map((k) => k.c));
      } catch {
        /* handled below: asset is skipped */
      }
    }),
  );

  const signals = index.constituents.flatMap((c): OrcaSignal[] => {
    const series = closes.get(c.symbol);
    // Daily candle series ends with today's partial candle; measure trend from the last full closes + live price.
    const at = (daysAgo: number) => series && series.length > daysAgo ? series[series.length - 1 - daysAgo] : null;
    const ref7 = at(7);
    const ref14 = at(14);
    const return7dPct = ref7 ? (c.price / ref7 - 1) * 100 : null;
    const return14dPct = ref14 ? (c.price / ref14 - 1) * 100 : null;

    const related = news.items.filter((n) => n.symbols.includes(c.symbol));
    const bull = related.filter((n) => n.sentiment === "bullish");
    const bear = related.filter((n) => n.sentiment === "bearish");
    const newsBias = related.length
      ? (bull.reduce((s, n) => s + n.conviction, 0) - bear.reduce((s, n) => s + n.conviction, 0)) /
        related.length
      : 0;

    const scored = scoreSignal({ return7dPct, return14dPct, newsBias });
    if (!scored) return [];
    const { score, direction } = scored;

    const touching = contra.items.filter(
      (x) => x.title.includes(c.symbol) || x.signalA.value.includes(c.symbol) || x.signalB.value.includes(c.symbol),
    );
    const worst = touching.reduce<number>((m, x) => Math.max(m, SEVERITY_RANK[x.severity]), 0);
    const riskFlag = (["none", "low", "medium", "high"] as const)[worst];

    const conviction = convictionFrom({ score, direction, headlines: related.length, worstSeverity: worst });

    return [{
      id: `sig_${c.symbol.toLowerCase()}`,
      asset: c.symbol,
      direction,
      conviction,
      price: c.price,
      change24h: c.change24h,
      rationale: [
        `${(return7dPct as number) >= 0 ? "+" : ""}${(return7dPct as number).toFixed(1)}% over 7d, ${(return14dPct as number) >= 0 ? "+" : ""}${(return14dPct as number).toFixed(1)}% over 14d (${c.change24h >= 0 ? "+" : ""}${c.change24h}% 24h)`,
        related.length
          ? `${related.length} related headline${related.length > 1 ? "s" : ""} (${bull.length} bullish, ${bear.length} bearish)`
          : "No related headlines in window",
      ],
      citations: related.slice(0, 3).map((n) => ({ id: n.id, title: n.title, source: n.source })),
      contradictions: touching,
      riskFlag,
    }];
  });

  // The other tradable tokens, trend-only. If market data is down the news-covered majors still work.
  const extended = await buildExtendedSignals(new Set(signals.map((s) => s.asset))).catch(() => []);
  signals.push(...extended);

  signals.sort((a, b) => b.conviction - a.conviction);
  return { signals, generatedAt: Date.now(), source: index.source };
}

export async function getSignal(asset: string): Promise<{ signal: OrcaSignal | null; source: string }> {
  const { signals, source } = await buildSignals();
  return { signal: signals.find((s) => s.asset === asset.toUpperCase()) ?? null, source };
}
