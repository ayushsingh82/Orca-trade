import { TOKENS, tokenBySymbol } from "./mints";

/**
 * Reference prices for the quote guard. SoSoValue is the primary source; CoinGecko is an independent
 * second source. If the two disagree by more than the allowed spread, we do not know the true price, so
 * the trade is refused rather than sized off either number.
 */
const MAX_SPREAD_BPS = Number(process.env.REFERENCE_MAX_SPREAD_BPS ?? 150);
const CACHE_MS = 60_000;

const COINGECKO_IDS: Record<string, string> = { SOL: "solana", BTC: "bitcoin", ETH: "ethereum" };

type Cache = { at: number; prices: Record<string, number> };
const g = globalThis as unknown as { __orcaCg?: Cache };

/** Pure: the average of the sources, or an error if they disagree by more than `maxSpreadBps`. */
export function crossCheck(prices: number[], maxSpreadBps = MAX_SPREAD_BPS): number {
  const valid = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (valid.length !== prices.length || valid.length === 0) throw new Error("reference price unavailable or invalid");
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  const spreadBps = ((hi - lo) / lo) * 1e4;
  if (spreadBps > maxSpreadBps) {
    throw new Error(`price sources disagree by ${spreadBps.toFixed(0)}bps (allowed ${maxSpreadBps}bps); refusing to trade`);
  }
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

async function fetchCoinGecko(): Promise<Record<string, number>> {
  const key = process.env.COINGECKO_API_KEY;
  const ids = Object.values(COINGECKO_IDS).join(",");
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {
    headers: key ? { "x-cg-demo-api-key": key } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = (await res.json()) as Record<string, { usd?: number }>;
  const out: Record<string, number> = {};
  for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
    const usd = json[id]?.usd;
    if (typeof usd === "number") out[symbol] = usd;
  }
  return out;
}

/** Smallest on-chain liquidity (USD) we accept for a non-core token, so a thin or manipulable pool is never traded. */
export const MIN_LIQUIDITY_USD = 2_000_000;

type JupToken = { id?: string; usdPrice?: number; liquidity?: number; isVerified?: boolean };

/** Pure: Jupiter's verified price and liquidity for one mint out of a token-search result. */
export function pickJupiterPrice(results: unknown, mint: string): { price: number; liquidity: number } {
  const t = Array.isArray(results) ? (results as JupToken[]).find((x) => x.id === mint) : undefined;
  if (!t) throw new Error("token not found on Jupiter");
  if (!t.isVerified) throw new Error("token is not verified on Jupiter");
  if (!(typeof t.usdPrice === "number" && t.usdPrice > 0)) throw new Error("Jupiter has no price for this token");
  const liquidity = typeof t.liquidity === "number" ? t.liquidity : 0;
  if (liquidity < MIN_LIQUIDITY_USD) throw new Error(`on-chain liquidity $${Math.round(liquidity).toLocaleString()} is below the $${MIN_LIQUIDITY_USD.toLocaleString()} minimum`);
  return { price: t.usdPrice, liquidity };
}

const jupCache = new Map<string, { at: number; price: number }>();

/** Jupiter's own price for a token, independent of CoinGecko. Also enforces the liquidity floor. */
export async function getJupiterPrice(mint: string): Promise<number> {
  const hit = jupCache.get(mint);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.price;
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`Jupiter ${res.status}`);
  const { price } = pickJupiterPrice(await res.json(), mint);
  jupCache.set(mint, { at: Date.now(), price });
  return price;
}

export async function getCoinGeckoPrice(asset: string): Promise<number> {
  const symbol = asset.toUpperCase();
  if (!(symbol in TOKENS) || !COINGECKO_IDS[symbol]) throw new Error(`no CoinGecko id for ${symbol}`);
  if (!g.__orcaCg || Date.now() - g.__orcaCg.at > CACHE_MS) g.__orcaCg = { at: Date.now(), prices: await fetchCoinGecko() };
  const p = g.__orcaCg.prices[symbol];
  if (!(p > 0)) throw new Error(`CoinGecko has no price for ${symbol}`);
  return p;
}

/**
 * Cross-checks the primary price against CoinGecko. With `requireSecond` (live agents) a missing second
 * source blocks the trade. Without it (paper agents) the primary price is used, but a source that is up
 * and disagrees still blocks it.
 */
export async function resolveReferencePrice(asset: string, primary: number, opts: { requireSecond: boolean }): Promise<number> {
  let second: number;
  try {
    const token = tokenBySymbol(asset);
    // Core assets: SoSoValue vs CoinGecko. Other tokens use CoinGecko as the primary price, so their independent
    // check is Jupiter's own token price (which also enforces the liquidity floor).
    second = token && token.risk !== "core" ? await getJupiterPrice(token.mint) : await getCoinGeckoPrice(asset);
  } catch (e) {
    if (opts.requireSecond) throw new Error(`second price source unavailable: ${e instanceof Error ? e.message : "error"}`);
    return crossCheck([primary]);
  }
  return crossCheck([primary, second]);
}
