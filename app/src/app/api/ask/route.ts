import { NextRequest, NextResponse } from "next/server";
import { runMarketMindAnalysis } from "@/lib/intel/marketmind";

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ ok: false, error: "query is required" }, { status: 400 });
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
