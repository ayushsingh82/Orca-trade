import { NextRequest, NextResponse } from "next/server";
import { runMarketMindAnalysis } from "@/lib/intel/marketmind";
import { getUser } from "@/lib/auth/session";
import { consume, refund } from "@/lib/entitlements";
import { hasLlmKey } from "@/lib/intel/llm";

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Sign in to use Ask Orca" }, { status: 401 });

    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ ok: false, error: "query is required" }, { status: 400 });
    }
    // Fail before charging the user's daily quota when the service itself cannot answer.
    if (!hasLlmKey()) {
      return NextResponse.json({ ok: false, error: "Ask Orca is not available right now" }, { status: 503 });
    }
    const quota = await consume(user, "ask");
    if (!quota.allowed) {
      return NextResponse.json(
        { ok: false, error: `Daily Ask limit reached for the ${user.plan} plan` },
        { status: 429 },
      );
    }

    try {
      const { analysis, source } = await runMarketMindAnalysis(query);
      return NextResponse.json({ ok: true, data: { query, analysis }, source, generatedAt: Date.now() });
    } catch (e) {
      await refund(user, "ask"); // a failed answer should not cost a question
      throw e;
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
