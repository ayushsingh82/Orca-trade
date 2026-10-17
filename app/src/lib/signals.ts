// OrcaSignal: the contract between the Intelligence layer and the Agent runtime.
// Evolved from MarketMind's `marketmind.autofund.signal/v1` handoff payload.
import { buildLiveNewsImpacts, detectContradictions } from "./intel/marketmind";
import { buildMarketMindIndex } from "./intel/ssi";
import { clamp } from "./intel/analytics";
import type { Contradiction } from "./intel/types";

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

  const signals = index.constituents.map((c): OrcaSignal => {
    const related = news.items.filter((n) => n.symbols.includes(c.symbol));
    const bull = related.filter((n) => n.sentiment === "bullish");
    const bear = related.filter((n) => n.sentiment === "bearish");
    const newsBias = related.length
      ? (bull.reduce((s, n) => s + n.conviction, 0) - bear.reduce((s, n) => s + n.conviction, 0)) /
        related.length
      : 0;

    // Blend price momentum and news bias into one directional score (-100..100).
    const score = clamp(c.change24h * 8 + newsBias * 0.6, -100, 100);
    const direction = score > 8 ? "long" : score < -8 ? "short" : "neutral";

    const touching = contra.items.filter(
      (x) => x.title.includes(c.symbol) || x.signalA.value.includes(c.symbol) || x.signalB.value.includes(c.symbol),
    );
    const worst = touching.reduce<number>((m, x) => Math.max(m, SEVERITY_RANK[x.severity]), 0);
    const riskFlag = (["none", "low", "medium", "high"] as const)[worst];

    // Contradictions erode conviction.
    const base = Math.abs(score) + (direction === "neutral" ? 0 : related.length * 4);
    const conviction = Math.round(clamp(base - worst * 6, 5, 95));

    return {
      id: `sig_${c.symbol.toLowerCase()}`,
      asset: c.symbol,
      direction,
      conviction,
      price: c.price,
      change24h: c.change24h,
      rationale: [
        `${c.change24h >= 0 ? "+" : ""}${c.change24h}% over 24h`,
        related.length
          ? `${related.length} related headline${related.length > 1 ? "s" : ""} (${bull.length} bullish, ${bear.length} bearish)`
          : "No related headlines in window",
      ],
      citations: related.slice(0, 3).map((n) => ({ id: n.id, title: n.title, source: n.source })),
      contradictions: touching,
      riskFlag,
    };
  });

  signals.sort((a, b) => b.conviction - a.conviction);
  return { signals, generatedAt: Date.now(), source: index.source };
}

export async function getSignal(asset: string): Promise<{ signal: OrcaSignal | null; source: string }> {
  const { signals, source } = await buildSignals();
  return { signal: signals.find((s) => s.asset === asset.toUpperCase()) ?? null, source };
}
