import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { signupClosedResponse } from "@/lib/billing/flags";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const closed = signupClosedResponse();
  if (closed) return closed;
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  // Slows password guessing: per address+email and per address overall.
  const ip = clientIp(req);
  const limits = [rateLimit(`login:${ip}:${email?.trim().toLowerCase()}`, 8, 15 * 60_000), rateLimit(`login:${ip}`, 40, 15 * 60_000)];
  const blocked = limits.find((l) => !l.allowed);
  if (blocked) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429, headers: { "retry-after": String(blocked.retryAfterSec) } });
  }
  const [user] = email
    ? await db().select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1)
    : [];
  // Same error for unknown email and wrong password.
  if (!user?.passwordHash || !password || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ ok: false, error: "invalid email or password" }, { status: 401 });
  }
  await startSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, plan: user.plan } });
}
