import { type TradableToken, tokenByCgId } from "@/lib/exec/mints";
import { cgGet } from "./cg";

export type MarketRow = {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  rank: number | null;
  price: number;
  marketCap: number | null;
  volume24h: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change14d: number | null;
  change30d: number | null;
  /** About 7 days of hourly prices, oldest first. */
  sparkline: number[];
  ath: number | null;
  athChangePct: number | null;
  isStable: boolean;
  /** Set when agents may trade this token. */
  tradable: TradableToken | null;
};

type Raw = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const STABLE_SYMBOLS = new Set(["USDT", "USDC", "USDS", "USDE", "DAI", "USD1", "PYUSD", "FDUSD", "TUSD", "USDG", "USDY", "USYC", "BUIDL", "USDD", "FRAX", "LUSD", "GUSD", "USDP", "RLUSD", "USDTB", "USTB", "OUSD", "SUSDE", "USDGO", "SYRUPUSDC", "BFUSD", "USDF"]);

/** Stablecoins and tokenised funds are not trading targets. A symbol list plus a price-pinned-near-$1 USD-named check. */
export function isStablecoin(symbol: string, name: string, price: number, change7d: number | null): boolean {
  if (STABLE_SYMBOLS.has(symbol.toUpperCase())) return true;
  return price > 0.97 && price < 1.03 && /usd|dollar/i.test(name) && Math.abs(change7d ?? 0) < 1.5;
}

/** Pure: one CoinGecko /coins/markets row to our shape. */
export function toRow(raw: Raw): MarketRow | null {
  const price = num(raw.current_price);
  if (typeof raw.id !== "string" || typeof raw.symbol !== "string" || price === null || price <= 0) return null;
  const symbol = raw.symbol.toUpperCase();
  const name = typeof raw.name === "string" ? raw.name : symbol;
  const spark = (raw.sparkline_in_7d as { price?: unknown[] } | undefined)?.price;
  const change7d = num(raw.price_change_percentage_7d_in_currency);
  return {
    id: raw.id,
    symbol,
    name,
    image: typeof raw.image === "string" ? raw.image : null,
    rank: num(raw.market_cap_rank),
    price,
    marketCap: num(raw.market_cap),
    volume24h: num(raw.total_volume),
    change1h: num(raw.price_change_percentage_1h_in_currency),
    change24h: num(raw.price_change_percentage_24h_in_currency) ?? num(raw.price_change_percentage_24h),
    change7d,
    change14d: num(raw.price_change_percentage_14d_in_currency),
    change30d: num(raw.price_change_percentage_30d_in_currency),
    sparkline: Array.isArray(spark) ? spark.filter((p): p is number => typeof p === "number") : [],
    ath: num(raw.ath),
    athChangePct: num(raw.ath_change_percentage),
    isStable: isStablecoin(symbol, name, price, change7d),
    tradable: tokenByCgId(raw.id) ?? null,
  };
}

const PCT = "price_change_percentage=1h,24h,7d,14d,30d";
const rows = (raw: Raw[]) => raw.map(toRow).filter((r): r is MarketRow => r !== null);

/** The top assets by market cap, stablecoins included (the table can hide them). */
export async function getTopMarkets(count = 50): Promise<MarketRow[]> {
  const raw = await cgGet<Raw[]>(`/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${count}&page=1&sparkline=true&${PCT}`, 5 * 60_000);
  return rows(raw);
}

/** Specific coins by CoinGecko id, ordered by market cap. At most 100 ids. */
export async function getMarketsByIds(ids: string[]): Promise<MarketRow[]> {
  const unique = [...new Set(ids)].slice(0, 100).sort();
  if (unique.length === 0) return [];
  const raw = await cgGet<Raw[]>(`/coins/markets?vs_currency=usd&ids=${unique.join(",")}&order=market_cap_desc&per_page=100&page=1&sparkline=true&${PCT}`, 5 * 60_000);
  return rows(raw);
}

/**
 * Well-known Solana ecosystem tokens, by CoinGecko id. Curated by hand because CoinGecko's own "solana-ecosystem"
 * category is mostly stablecoins and multi-chain assets. Tokens that are not in the tradable registry are view-only.
 */
export const SOLANA_ECOSYSTEM_IDS = [
  "solana", "jupiter-exchange-solana", "pump-fun", "official-trump", "pyth-network", "render-token", "pudgy-penguins", "raydium",
  "bonk", "dogwifcoin", "kamino", "jito-governance-token", "fartcoin", "popcat", "helium", "wormhole", "grass", "orca",
  "cat-in-a-dogs-world", "io", "drift-protocol", "tensor", "marinade", "jito-staked-sol", "marinade-staked-sol",
];

export async function getSolanaMarkets(): Promise<MarketRow[]> {
  return getMarketsByIds(SOLANA_ECOSYSTEM_IDS);
}

export type SearchHit = Pick<MarketRow, "id" | "symbol" | "name" | "image" | "rank" | "tradable">;

/** Normalises a user query, or returns null when it is too short to search. */
export function normalizeQuery(q: string): string | null {
  const s = q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
  return s.length >= 2 ? s : null;
}

/** Search any coin CoinGecko lists (thousands), best market-cap rank first, with live market data for the top hits. */
export async function searchTokens(query: string, limit = 12): Promise<MarketRow[]> {
  const q = normalizeQuery(query);
  if (!q) return [];
  const res = await cgGet<{ coins?: { id: string; market_cap_rank: number | null }[] }>(`/search?query=${encodeURIComponent(q)}`, 10 * 60_000);
  const ids = (res.coins ?? [])
    .filter((c) => typeof c.id === "string")
    .sort((a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9))
    .slice(0, limit)
    .map((c) => c.id);
  return getMarketsByIds(ids);
}
