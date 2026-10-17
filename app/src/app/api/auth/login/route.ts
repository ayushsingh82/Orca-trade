import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
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
