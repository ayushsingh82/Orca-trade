import { round, takerBuyStats } from "./analytics";
import type { SodexTrade } from "./sodex";

// Live order book and trade flow from Coinbase Exchange public market data (no key, works from US hosts).
const BASE = "https://api.exchange.coinbase.com";

export type OrderFlow = {
  symbol: string;
  spreadBps: number;
  /** (bid depth - ask depth) / total, over the top levels. Positive = bids are heavier. */
  depthImbalance: number;
  takerBuyRatio: number;
  netFlowUsd: number;
  buyVolUsd: number;
  sellVolUsd: number;
  trades: number;
};

type Level = [string, string, number | string];
type RawTrade = { trade_id: number; side: "buy" | "sell"; size: string; price: string; time: string };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8_000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`order flow unavailable (${res.status})`);
  return (await res.json()) as T;
}

/** Pure: builds the metrics from a level-2 book and recent trades. Coinbase reports the MAKER side, so a "sell" is a buyer taking liquidity. */
export function computeOrderFlow(symbol: string, book: { bids: Level[]; asks: Level[] }, trades: RawTrade[]): OrderFlow {
  const levels = (ls: Level[]) => ls.slice(0, 20).map(([p, s]) => ({ price: Number(p), size: Number(s) })).filter((l) => l.price > 0 && Number.isFinite(l.size));
  const bids = levels(book.bids);
  const asks = levels(book.asks);
  if (!bids.length || !asks.length) throw new Error("empty order book");
  const bidDepth = bids.reduce((s, l) => s + l.size, 0);
  const askDepth = asks.reduce((s, l) => s + l.size, 0);
  const mid = (bids[0].price + asks[0].price) / 2;
  const asTaker: SodexTrade[] = trades.map((t) => ({
    id: String(t.trade_id),
    symbol,
    side: t.side === "sell" ? "BUY" : "SELL",
    price: Number(t.price),
    size: Number(t.size),
    ts: Date.parse(t.time),
  }));
  const stats = takerBuyStats(asTaker);
  return {
    symbol,
    spreadBps: round(((asks[0].price - bids[0].price) / mid) * 10_000, 2),
    depthImbalance: round((bidDepth - askDepth) / (bidDepth + askDepth), 3),
    takerBuyRatio: stats.takerBuyRatio,
    netFlowUsd: stats.netFlow,
    buyVolUsd: stats.buyVol,
    sellVolUsd: stats.sellVol,
    trades: asTaker.length,
  };
}

export async function getOrderFlow(symbol: string): Promise<OrderFlow> {
  const product = `${symbol.toUpperCase()}-USD`;
  const [book, trades] = await Promise.all([
    get<{ bids: Level[]; asks: Level[] }>(`/products/${product}/book?level=2`),
    get<RawTrade[]>(`/products/${product}/trades?limit=100`),
  ]);
  return computeOrderFlow(symbol.toUpperCase(), book, trades);
}
