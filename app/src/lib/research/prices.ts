import type { Point } from "./rsi";

export const RESEARCH_ASSETS: { symbol: string; id: string; name: string }[] = [
  { symbol: "BTC", id: "bitcoin", name: "Bitcoin" },
  { symbol: "ETH", id: "ethereum", name: "Ethereum" },
  { symbol: "SOL", id: "solana", name: "Solana" },
  { symbol: "BNB", id: "binancecoin", name: "BNB" },
  { symbol: "XRP", id: "ripple", name: "XRP" },
];

type Entry = { at: number; points: Point[] };
const g = globalThis as unknown as { __orcaHist?: Map<string, Entry>; __orcaHistInflight?: Map<string, Promise<Point[]>>; __orcaHistLast?: number };
const cache = (g.__orcaHist ??= new Map());
const inflight = (g.__orcaHistInflight ??= new Map());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHistory(id: string, days: number): Promise<Point[]> {
  const key = process.env.COINGECKO_API_KEY;
  // The free tier is rate limited, so space requests out and retry once on 429.
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = (key ? 1_200 : 2_500) - (Date.now() - (g.__orcaHistLast ?? 0));
    if (wait > 0) await sleep(wait);
    g.__orcaHistLast = Date.now();
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`, {
      headers: key ? { "x-cg-demo-api-key": key } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Math.min(20_000, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5 * (attempt + 1)) * 1_000));
      continue;
    }
    if (!res.ok) throw new Error(`price history unavailable (${res.status})`);
    const json = (await res.json()) as { prices?: [number, number][] };
    const points = (json.prices ?? []).map(([t, p]) => ({ t, p })).filter((x) => Number.isFinite(x.p) && x.p > 0);
    if (points.length < 30) throw new Error("price history too short");
    return points;
  }
  throw new Error("price history rate limited, try again shortly");
}

/** Cached, de-duplicated history. Serves stale data if a refresh fails. CoinGecko returns hourly points for 2-90 days and daily beyond. */
async function history(id: string, days: number, ttlMs: number): Promise<Point[]> {
  const k = `${id}:${days}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < ttlMs) return hit.points;
  const pending = inflight.get(k);
  if (pending) return pending;
  const p = fetchHistory(id, days)
    .then((points) => {
      cache.set(k, { at: Date.now(), points });
      return points;
    })
    .catch((e) => {
      if (hit) return hit.points;
      throw e;
    })
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

/** ~90 days of hourly prices. */
export const getHourly = (id: string) => history(id, 90, 30 * 60_000);
/** ~365 days of daily prices. */
export const getDaily = (id: string) => history(id, 365, 12 * 3_600_000);
