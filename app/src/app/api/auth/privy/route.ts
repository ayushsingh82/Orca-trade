import { NextRequest, NextResponse } from "next/server";
import { privyConfigured, upsertPrivyUser, verifyPrivyToken } from "@/lib/auth/privy";
import { startSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { signupClosedResponse } from "@/lib/billing/flags";

export const runtime = "nodejs";

/**
 * Exchanges a Privy access token for an Orca session. The token is verified with Privy; nothing the browser
 * sends about the user (email, wallet) is trusted, it is all read back from Privy.
 */
export async function POST(req: NextRequest) {
  const closed = signupClosedResponse();
  if (closed) return closed;
  if (!privyConfigured()) return NextResponse.json({ ok: false, error: "Privy sign-in is not configured" }, { status: 503 });
  const limit = rateLimit(`privy:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  }
  const { token, ref } = (await req.json().catch(() => ({}))) as { token?: string; ref?: string };
  if (!token) return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });

  let identity;
  try {
    identity = await verifyPrivyToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: "sign-in could not be verified" }, { status: 401 });
  }
  const user = await upsertPrivyUser(identity, ref);
  await startSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, wallet: user.wallet, plan: user.plan } });
}
