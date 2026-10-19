import type { NextRequest } from "next/server";

type Bucket = { hits: number[] };
const g = globalThis as unknown as { __orcaRl?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__orcaRl ??= new Map());

/**
 * Sliding-window limiter. In memory, so each serverless instance counts separately: it slows brute-force and
 * scripted sign-ups, but it is not an exact global limit. Pure apart from the shared map; `now` is injectable.
 */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= max) {
    buckets.set(key, b);
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((b.hits[0] + windowMs - now) / 1000)) };
  }
  b.hits.push(now);
  buckets.set(key, b);
  // Keep the map from growing without bound.
  if (buckets.size > 5_000) for (const [k, v] of buckets) if (v.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
  return { allowed: true, retryAfterSec: 0 };
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
