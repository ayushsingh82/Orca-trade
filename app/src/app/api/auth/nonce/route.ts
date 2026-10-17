import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { signToken } from "@/lib/auth/session";
import { signInMessage } from "@/lib/auth/solana";

export const runtime = "nodejs";

/** Issues a stateless, 5-minute sign-in challenge bound to the wallet. */
export async function POST(req: NextRequest) {
  const { wallet } = (await req.json().catch(() => ({}))) as { wallet?: string };
  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    return NextResponse.json({ ok: false, error: "valid wallet required" }, { status: 400 });
  }
  const nonce = randomBytes(16).toString("hex");
  const message = signInMessage({ domain: req.nextUrl.host, wallet, nonce });
  const challenge = await signToken({ wallet, nonce }, 300);
  return NextResponse.json({ ok: true, message, challenge });
}
