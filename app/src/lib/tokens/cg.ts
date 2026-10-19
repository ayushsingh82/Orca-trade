// Shared CoinGecko client for market data. The free tiers are rate limited, so requests are spaced out, cached,
// de-duplicated while in flight, and served stale if a refresh fails.
const BASE = "https://api.coingecko.com/api/v3";

type Entry = { at: number; data: unknown };
const g = globalThis as unknown as { __orcaCgCache?: Map<string, Entry>; __orcaCgInflight?: Map<string, Promise<unknown>>; __orcaCgLast?: number };
const cache: Map<string, Entry> = (g.__orcaCgCache ??= new Map());
const inflight: Map<string, Promise<unknown>> = (g.__orcaCgInflight ??= new Map());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(path: string): Promise<T> {
  const key = process.env.COINGECKO_API_KEY;
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = (key ? 1_100 : 2_500) - (Date.now() - (g.__orcaCgLast ?? 0));
    if (wait > 0) await sleep(wait);
    g.__orcaCgLast = Date.now();
    const res = await fetch(`${BASE}${path}`, { headers: key ? { "x-cg-demo-api-key": key } : {}, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after"));
      await sleep(Math.min(15_000, (Number.isFinite(retry) && retry > 0 ? retry : 4 * (attempt + 1)) * 1_000));
      continue;
    }
    if (!res.ok) throw new Error(`market data unavailable (${res.status})`);
    return (await res.json()) as T;
  }
  throw new Error("market data is rate limited, try again shortly");
}

/** GET with a TTL cache. Stale data is returned when the refresh fails, so a provider hiccup does not blank the page. */
export async function cgGet<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;
  const p = fetchJson<T>(path)
    .then((data) => {
      cache.set(path, { at: Date.now(), data });
      if (cache.size > 500) cache.delete(cache.keys().next().value as string);
      return data;
    })
    .catch((e) => {
      if (hit) return hit.data as T;
      throw e;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}
