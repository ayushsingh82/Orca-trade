import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { normalizeQuery, searchTokens } from "@/lib/tokens/markets";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Public token search over every coin CoinGecko lists. Rate limited per address because each search costs an upstream call. */
export async function GET(req: NextRequest) {
  const limit = rateLimit(`tsearch:${clientIp(req)}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many searches. Slow down a little." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  const q = normalizeQuery(req.nextUrl.searchParams.get("q") ?? "");
  if (!q) return NextResponse.json({ ok: true, results: [] });
  try {
    const rows = await searchTokens(q, 10);
    return NextResponse.json({
      ok: true,
      results: rows.map((r) => ({ id: r.id, symbol: r.symbol, name: r.name, image: r.image, rank: r.rank, price: r.price, change24h: r.change24h, tradable: Boolean(r.tradable), risk: r.tradable?.risk ?? null })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "search failed" }, { status: 502 });
  }
}
