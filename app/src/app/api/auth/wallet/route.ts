import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { startSession, verifyToken } from "@/lib/auth/session";
import { signInMessage, verifyWalletSignature } from "@/lib/auth/solana";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { wallet, signature, challenge } = (await req.json().catch(() => ({}))) as {
    wallet?: string;
    signature?: string;
    challenge?: string;
  };
  if (!wallet || !signature || !challenge) {
    return NextResponse.json({ ok: false, error: "wallet, signature and challenge required" }, { status: 400 });
  }
  const claims = await verifyToken<{ wallet?: string; nonce?: string }>(challenge);
  if (!claims || claims.wallet !== wallet || !claims.nonce) {
    return NextResponse.json({ ok: false, error: "challenge invalid or expired" }, { status: 401 });
  }
  const message = signInMessage({ domain: req.nextUrl.host, wallet, nonce: claims.nonce });
  if (!verifyWalletSignature({ wallet, message, signature })) {
    return NextResponse.json({ ok: false, error: "signature invalid" }, { status: 401 });
  }

  const [existing] = await db().select().from(users).where(eq(users.wallet, wallet)).limit(1);
  const user = existing ?? (await db().insert(users).values({ wallet }).returning())[0];
  await startSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, wallet: user.wallet, plan: user.plan } });
}
