import { NextRequest, NextResponse } from "next/server";
import { runMarketMindAnalysis } from "@/lib/intel/marketmind";
import { getUser } from "@/lib/auth/session";
import { consume } from "@/lib/entitlements";

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
    const quota = await consume(user, "ask");
    if (!quota.allowed) {
      return NextResponse.json(
        { ok: false, error: `Daily Ask limit reached for the ${user.plan} plan` },
        { status: 429 },
      );
    }

    const { analysis, source } = await runMarketMindAnalysis(query);
    return NextResponse.json({ ok: true, data: { query, analysis }, source, generatedAt: Date.now() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
