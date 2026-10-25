import { NextRequest, NextResponse } from "next/server";
import { runMarketMindAnalysis } from "@/lib/intel/marketmind";
import { getUser } from "@/lib/auth/session";
import { consume, refund } from "@/lib/entitlements";
import { hasLlmKey } from "@/lib/intel/llm";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const revalidate = 0;

/** Free questions a signed-out visitor gets per day, per IP. In memory, so approximate across serverless instances. */
const GUEST_ASKS_PER_DAY = 3;

export async function POST(request: NextRequest) {
  try {
    // A broken session or database must not lock the visitor out: they fall back to the guest allowance.
    const user = await getUser().catch(() => null);
    if (!user) {
      const guest = rateLimit(`ask-guest:${clientIp(request)}`, GUEST_ASKS_PER_DAY, 24 * 60 * 60_000);
      if (!guest.allowed) {
        return NextResponse.json({ ok: false, error: `You have used your ${GUEST_ASKS_PER_DAY} free questions for today. Sign in for more.` }, { status: 429 });
      }
    }

    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ ok: false, error: "query is required" }, { status: 400 });
    }
    // Fail before charging the user's daily quota when the service itself cannot answer.
    if (!hasLlmKey()) {
      return NextResponse.json({ ok: false, error: "Ask Orca is not available right now" }, { status: 503 });
    }
    const quota = user ? await consume(user, "ask") : { allowed: true };
    if (!quota.allowed && user) {
      return NextResponse.json(
        { ok: false, error: `Daily Ask limit reached for the ${user.plan} plan` },
        { status: 429 },
      );
    }

    try {
      const { analysis, source } = await runMarketMindAnalysis(query);
      return NextResponse.json({ ok: true, data: { query, analysis }, source, generatedAt: Date.now() });
    } catch (e) {
      if (user) await refund(user, "ask"); // a failed answer should not cost a question
      throw e;
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
