import {
  getEtfFlows,
  getKlines,
  getMacroEvents,
  getMarketSnapshot,
  getNews,
  getSectorSpotlight,
  hasSosoKey,
  type NewsItem,
} from "./sosovalue";
import { getMarkPrices, getRecentTrades, hasSodexKey } from "./sodex";
import {
  classifyNews,
  computePriceImpact,
  deriveConviction,
  deriveSentiment,
  takerBuyStats,
  toSodexPair,
} from "./analytics";
import { generateBrief, hasLlmKey, runMarketMindLLM, type LlmContext } from "./llm";
import type { AskResponse, Contradiction, NewsImpact } from "./types";

// Orca intelligence engine (ported from MarketMind). Real data only: no mock
// fallbacks, no templated theses. Anything unavailable throws or is omitted.

function extractSymbols(query: string): string[] {
  const q = query.toUpperCase();
  const universe = [
    "BTC", "ETH", "SOL", "ARB", "OP", "AVAX", "ADA", "MATIC", "LINK",
    "DOGE", "PEPE", "WIF", "BONK", "FET", "RNDR", "TAO", "AGIX", "ONDO",
    "MKR", "AAVE", "UNI", "LDO", "BNB", "XRP",
  ];
  return universe.filter((s) => q.includes(s));
}

// ---------------------------------------------------------------------------
// Ask Orca: grounded LLM over live SoSoValue data. Throws if the LLM or the data
// source is unavailable; there is no templated fallback.
// ---------------------------------------------------------------------------

export async function runMarketMindAnalysis(query: string): Promise<{ analysis: AskResponse; source: string }> {
  if (!hasLlmKey()) throw new Error("LLM not configured (set OPENAI_BASE_URL / OPENAI_MODEL / OPENAI_API_KEY)");
  const ctx = await gatherContext(query, extractSymbols(query));
  const { analysis, source } = await runMarketMindLLM(ctx);
  return { analysis, source };
}

export async function runMarketMindBrief(): Promise<{ brief: string; source: string }> {
  if (!hasLlmKey()) throw new Error("LLM not configured");
  const ctx = await gatherContext("market overview right now", []);
  const { text, live, source } = await generateBrief(ctx);
  if (!live || !text) throw new Error("LLM returned no brief");
  return { brief: text, source };
}

async function gatherContext(query: string, symbols: string[]): Promise<LlmContext> {
  if (!hasSosoKey()) throw new Error("Missing SOSO_API_KEY");
  const [newsRes, marketRes, sectorRes, macroRes] = await Promise.all([
    getNews(8),
    getMarketSnapshot(),
    getSectorSpotlight(),
    getMacroEvents(),
  ]);
  const news: LlmContext["news"] = (newsRes.data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    source: n.source,
    sentiment: n.sentiment ?? deriveSentiment(n.title),
    conviction: n.conviction ?? deriveConviction(n),
    symbols: n.symbols,
    publishedAt: n.publishedAt,
  }));
  const market = (marketRes.data ?? []).slice(0, 20).map((m) => ({ symbol: m.symbol, price: m.price, change24h: m.change24h }));
  const sectors = (sectorRes.data ?? []).map((s) => ({ sector: s.sector, change24h: s.change24h, marketCap: s.marketCap }));
  const macro = (macroRes.data ?? []).map((e) => ({ title: e.title, scheduledAt: e.scheduledAt, importance: e.importance }));

  // ETF flows for the focal asset (default BTC); optional context.
  const etfSym = symbols.includes("ETH") ? "us-eth-spot" : "us-btc-spot";
  const etf = await getEtfFlows(etfSym, 7).catch(() => ({ data: [] }));
  const etfFlows = etf.data?.length
    ? etf.data.map((f) => ({ symbol: f.symbol, date: f.date, totalNetInflow: f.totalNetInflow }))
    : undefined;

  return { query, news, sectors, macro, market, etfFlows };
}

// ---------------------------------------------------------------------------
// Real news-impact pipeline: join news with klines and measure actual returns.
// ---------------------------------------------------------------------------

const SYMBOL_TO_CURRENCY_ID: Record<string, string> = {
  BTC: "BTC", ETH: "ETH", SOL: "SOL", AVAX: "AVAX", ARB: "ARB",
  FET: "FET", RNDR: "RNDR", TAO: "TAO",
};

export async function buildLiveNewsImpacts(limit = 8): Promise<{ items: NewsImpact[]; source: string }> {
  if (!hasSosoKey()) throw new Error("Missing SOSO_API_KEY");
  {
    const newsRes = await getNews(limit);
    const news = newsRes.data ?? [];
    if (!news.length) return { items: [], source: "SoSoValue/news (empty)" };

    // Fetch klines once per distinct focal symbol referenced by the headlines.
    const focal = new Set<string>();
    for (const n of news) {
      const sym = (n.symbols ?? [])[0];
      if (sym && SYMBOL_TO_CURRENCY_ID[sym]) focal.add(sym);
    }
    if (focal.size === 0) focal.add("BTC");

    const klineMap = new Map<string, Awaited<ReturnType<typeof getKlines>>["data"]>();
    await Promise.all(
      [...focal].map(async (sym) => {
        try {
          const k = await getKlines(SYMBOL_TO_CURRENCY_ID[sym] ?? sym, "1m", 480);
          klineMap.set(sym, k.data);
        } catch {
          // leave unset → impact falls back to heuristic for that headline
        }
      }),
    );

    let measuredCount = 0;
    const items: NewsImpact[] = news.map((n, i) => {
      const sym = (n.symbols ?? [])[0] ?? "BTC";
      const klines = klineMap.get(sym);
      const sentiment = n.sentiment ?? deriveSentiment(n.title);
      const conviction = n.conviction ?? deriveConviction(n);
      const cls = classifyNews(n.title);

      let priceImpactPct: number;
      let reactionWindowMin: number;
      let decayHalfLifeMin: number;

      const impact = klines ? computePriceImpact(klines, n.publishedAt, 30) : null;
      if (impact) {
        measuredCount += 1;
        priceImpactPct = impact.priceImpactPct;
        reactionWindowMin = impact.reactionWindowMin;
        decayHalfLifeMin = impact.decayHalfLifeMin;
      } else {
        // No klines for this symbol: report as unmeasured, never estimate.
        priceImpactPct = 0;
        reactionWindowMin = 0;
        decayHalfLifeMin = 0;
      }

      return {
        id: n.id ?? `news_${i}`,
        title: n.title,
        source: n.source,
        publishedAt: n.publishedAt,
        sentiment,
        conviction,
        symbols: n.symbols ?? [sym],
        priceImpactPct,
        reactionWindowMin,
        decayHalfLifeMin,
        classification: cls,
        measured: impact != null,
        aiSummary:
          impact != null
            ? `Measured ${priceImpactPct >= 0 ? "+" : ""}${priceImpactPct}% over ${reactionWindowMin}m after release; impact half-life ≈ ${decayHalfLifeMin}m.`
            : `Sentiment read from headline only; price-window not measured for ${sym}.`,
      };
    });

    const source =
      measuredCount > 0
        ? `SoSoValue/news + klines (${measuredCount}/${items.length} price-measured)`
        : "SoSoValue/news + derived (klines unavailable)";
    return { items, source };
  }
}

// ---------------------------------------------------------------------------
// Multi-source contradiction detection — the signature hook.
//
// Each contradiction cites TWO real API surfaces. Checks:
//   1. news bias  vs  sector breadth        (SoSoValue news  ×  SoSoValue sectors)
//   2. news bias  vs  SoDEX taker-buy ratio  (SoSoValue news  ×  SoDEX trades)
//   3. news bias  vs  perps funding rate     (SoSoValue news  ×  SoDEX mark-prices)
//   4. macro window proximity vs sector risk-on breadth (SoSoValue macro × sectors)
// ---------------------------------------------------------------------------

export async function detectContradictions(): Promise<{ items: Contradiction[]; source: string }> {
  const now = Date.now();
  const items: Contradiction[] = [];
  const surfaces: string[] = [];

  if (!hasSosoKey() && !hasSodexKey()) throw new Error("No live data source configured");

  // --- Pull the inputs we have access to ---
  let news: NewsItem[] = [];
  let newsBias = 0;
  let bullishNews = 0;
  let bearishNews = 0;
  if (hasSosoKey()) {
    try {
      const n = await getNews(10);
      news = n.data ?? [];
      for (const item of news) {
        const s = item.sentiment ?? deriveSentiment(item.title);
        if (s === "bullish") bullishNews += 1;
        else if (s === "bearish") bearishNews += 1;
      }
      newsBias = bullishNews - bearishNews;
      surfaces.push("SoSoValue/news");
    } catch {
      /* ignore */
    }
  }

  // Check 1 + 4 need sectors + macro
  if (hasSosoKey()) {
    try {
      const sectorsRes = await getSectorSpotlight();
      const sectors = sectorsRes.data ?? [];
      const sectorBreadth = sectors.reduce((acc, s) => acc + (s.change24h > 0 ? 1 : -1), 0);
      surfaces.push("SoSoValue/sectors");

      // Check 1: news bias vs sector breadth
      if (newsBias !== 0 && Math.sign(sectorBreadth) !== Math.sign(newsBias)) {
        items.push({
          id: `contra_breadth_${now}`,
          title: "News bias and sector breadth disagree",
          signalA: { label: "News bias", value: `${newsBias >= 0 ? "+" : ""}${newsBias}`, source: "SoSoValue news" },
          signalB: { label: "Sector breadth", value: `${sectorBreadth >= 0 ? "+" : ""}${sectorBreadth} sectors`, source: "SoSoValue sectors" },
          severity: "high",
          confidence: 82,
          resolution: "Headline tone is tactical until breadth confirms — treat single-name leadership skeptically.",
          detectedAt: now,
        });
      }

      // Check 4: macro window proximity vs risk-on breadth
      const macroRes = await getMacroEvents().catch(() => ({ data: [] }));
      const macro = macroRes.data ?? [];
      const soon = macro
        .filter((m) => m.importance === "high")
        .map((m) => m.scheduledAt - now)
        .filter((dt) => dt > 0 && dt < 24 * 3_600_000)
        .sort((a, b) => a - b)[0];
      if (soon != null && sectorBreadth > 0) {
        surfaces.push("SoSoValue/macro");
        const hrs = Math.round(soon / 3_600_000);
        items.push({
          id: `contra_macro_${now}`,
          title: "Risk-on breadth into a high-impact macro window",
          signalA: { label: "Sector breadth", value: `+${sectorBreadth} sectors`, source: "SoSoValue sectors" },
          signalB: { label: "Macro event", value: `T-${hrs}h (high impact)`, source: "SoSoValue macro" },
          severity: "medium",
          confidence: 74,
          resolution: "Pre-event rallies often unwind; treat breadth as tactical until the print clears.",
          detectedAt: now,
        });
      }
    } catch {
      /* ignore */
    }
  }

  // Checks 2 + 3 need SoDEX. Anchor on the most-mentioned symbol, default BTC.
  if (hasSodexKey() && newsBias !== 0) {
    const focalSym = topSymbol(news) ?? "BTC";
    const pair = toSodexPair(focalSym);
    try {
      const trades = await getRecentTrades(pair, 60);
      const stats = takerBuyStats(trades.data);
      surfaces.push("SoDEX/trades");
      // Check 2: news bias vs taker-buy ratio
      const takerBullish = stats.takerBuyRatio > 0.52;
      const takerBearish = stats.takerBuyRatio < 0.48;
      const newsBullish = newsBias > 0;
      if ((newsBullish && takerBearish) || (!newsBullish && takerBullish)) {
        items.push({
          id: `contra_taker_${now}`,
          title: `News tone and ${pair} taker flow disagree`,
          signalA: { label: "News bias", value: `${newsBias >= 0 ? "+" : ""}${newsBias}`, source: "SoSoValue news" },
          signalB: { label: "Taker-buy ratio", value: `${(stats.takerBuyRatio * 100).toFixed(1)}%`, source: `SoDEX ${pair} trades` },
          severity: "medium",
          confidence: 76,
          resolution: "Tape is fading the headline; watch for flow to confirm before sizing.",
          detectedAt: now,
        });
      }
    } catch {
      /* ignore */
    }

    try {
      const marks = await getMarkPrices();
      surfaces.push("SoDEX/mark-prices");
      const perpSym = marks.data.find((m) => m.symbol.toUpperCase().includes(focalSym));
      if (perpSym) {
        // Check 3: news bias vs funding rate
        const fundingBullish = perpSym.fundingRate > 0.0001;
        const fundingBearish = perpSym.fundingRate < -0.0001;
        const newsBullish = newsBias > 0;
        if ((newsBullish && fundingBearish) || (!newsBullish && fundingBullish)) {
          items.push({
            id: `contra_funding_${now}`,
            title: `News tone and ${perpSym.symbol} funding disagree`,
            signalA: { label: "News bias", value: `${newsBias >= 0 ? "+" : ""}${newsBias}`, source: "SoSoValue news" },
            signalB: { label: "Funding rate", value: `${(perpSym.fundingRate * 100).toFixed(4)}%`, source: `SoDEX ${perpSym.symbol} perps` },
            severity: fundingBearish ? "high" : "medium",
            confidence: 79,
            resolution: "Derivatives positioning leans against the headline — a funding flip is the tell.",
            detectedAt: now,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (items.length === 0) {
    // Genuinely no disagreement detected across surfaces.
    return {
      items: [],
      source: surfaces.length
        ? `contradiction-engine: no disagreement across ${[...new Set(surfaces)].join(", ")}`
        : "internal/contradiction-engine (no live surfaces)",
    };
  }

  return {
    items,
    source: `contradiction-engine across ${[...new Set(surfaces)].join(", ")}`,
  };
}

function topSymbol(news: NewsItem[]): string | undefined {
  const counts = new Map<string, number>();
  for (const n of news) {
    for (const s of n.symbols ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [s, c] of counts) {
    if (c > bestN) {
      best = s;
      bestN = c;
    }
  }
  return best;
}
