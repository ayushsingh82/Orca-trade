import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parseWaitlist } from "@/lib/waitlist";

export const runtime = "nodejs";

/**
 * Public waitlist sign-up for the paid plans. Always answers the same on success, whether or not the email was
 * already on the list, so it cannot be used to check who has signed up.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`waitlist:${clientIp(req)}`, 6, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  const body = await req.json().catch(() => ({}));
  // A hidden field real visitors never fill in. Bots that do get a normal-looking success and nothing is stored.
  if (typeof (body as { website?: unknown }).website === "string" && (body as { website: string }).website.length > 0) return NextResponse.json({ ok: true });
  const parsed = parseWaitlist(body);
  if (typeof parsed === "string") return NextResponse.json({ ok: false, error: parsed }, { status: 400 });
  try {
    await db().insert(waitlist).values(parsed).onConflictDoUpdate({ target: waitlist.email, set: { plan: parsed.plan } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not save that right now. Please try again." }, { status: 500 });
  }
}
