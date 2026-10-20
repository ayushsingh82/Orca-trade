import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { resolveReferrer } from "@/lib/auth/referral";
import { startSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { signupClosedResponse } from "@/lib/billing/flags";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const closed = signupClosedResponse();
  if (closed) return closed;
  const limit = rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many sign-ups from this address. Try again later." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  }
  const { email, password, ref } = (await req.json().catch(() => ({}))) as { email?: string; password?: string; ref?: string };
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ ok: false, error: "password must be at least 8 characters" }, { status: 400 });
  }
  const [exists] = await db().select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (exists) return NextResponse.json({ ok: false, error: "email already registered" }, { status: 409 });

  const [user] = await db()
    .insert(users)
    .values({ email: normalized, passwordHash: await hashPassword(password), referredBy: await resolveReferrer(ref) })
    .returning();
  await startSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, plan: user.plan } });
}
