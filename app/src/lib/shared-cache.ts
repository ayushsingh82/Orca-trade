/**
 * Optional cross-instance cache on Upstash Redis (REST). Serverless instances each start with an empty in-memory
 * cache, so without this every cold instance re-spends the upstream rate limit. With UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN unset, both calls are no-ops and callers fall back to their in-memory cache.
 * Failures are swallowed on purpose: this is a speed-up, never a dependency.
 */
const url = () => process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN;

export const sharedCacheEnabled = () => Boolean(url() && token());

async function command(args: (string | number)[]): Promise<unknown> {
  const res = await fetch(url() as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(2_000),
  });
  if (!res.ok) throw new Error(`shared cache ${res.status}`);
  return ((await res.json()) as { result?: unknown }).result;
}

export type Shared<T> = { at: number; data: T };

export async function sharedGet<T>(key: string): Promise<Shared<T> | null> {
  if (!sharedCacheEnabled()) return null;
  try {
    const raw = await command(["GET", `orca:${key}`]);
    return typeof raw === "string" ? (JSON.parse(raw) as Shared<T>) : null;
  } catch {
    return null;
  }
}

/** Keeps the value for `keepSec` (longer than the freshness window, so a stale copy can still rescue a failed refresh). */
export async function sharedSet<T>(key: string, data: T, keepSec: number, now = Date.now()): Promise<void> {
  if (!sharedCacheEnabled()) return;
  try {
    await command(["SET", `orca:${key}`, JSON.stringify({ at: now, data } satisfies Shared<T>), "EX", Math.max(1, Math.round(keepSec))]);
  } catch {
    // ignore
  }
}
