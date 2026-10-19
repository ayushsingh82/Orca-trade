import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { watchlist } from "@/db/schema";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_ITEMS = 100;
/** CoinGecko ids are lowercase letters, digits and hyphens. Anything else is refused before it reaches the database. */
const validId = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9][a-z0-9-]{0,80}$/.test(s);

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const items = await db().select().from(watchlist).where(eq(watchlist.userId, user.id)).orderBy(desc(watchlist.createdAt));
  return NextResponse.json({ ok: true, items: items.map((i) => ({ id: i.coinId, symbol: i.symbol, name: i.name })) });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to follow tokens" }, { status: 401 });
  const { id, symbol, name } = (await req.json().catch(() => ({}))) as { id?: unknown; symbol?: unknown; name?: unknown };
  if (!validId(id) || typeof symbol !== "string" || typeof name !== "string") return NextResponse.json({ ok: false, error: "invalid token" }, { status: 400 });
  const count = (await db().select({ id: watchlist.coinId }).from(watchlist).where(eq(watchlist.userId, user.id))).length;
  if (count >= MAX_ITEMS) return NextResponse.json({ ok: false, error: `You can follow up to ${MAX_ITEMS} tokens` }, { status: 409 });
  await db()
    .insert(watchlist)
    .values({ userId: user.id, coinId: id, symbol: symbol.toUpperCase().slice(0, 20), name: name.slice(0, 80) })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (!validId(id)) return NextResponse.json({ ok: false, error: "invalid token" }, { status: 400 });
  await db().delete(watchlist).where(and(eq(watchlist.userId, user.id), eq(watchlist.coinId, id)));
  return NextResponse.json({ ok: true });
}
