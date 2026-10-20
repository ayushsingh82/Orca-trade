import { NextRequest, NextResponse } from "next/server";
import { getSentiment } from "@/lib/sentiment";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Public, cacheable live data for the landing page and the live pages. The shared cache keeps upstream calls low. */
export async function GET(req: NextRequest) {
  const limit = rateLimit(`sentiment:${clientIp(req)}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  try {
    return NextResponse.json({ ok: true, data: await getSentiment() }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
