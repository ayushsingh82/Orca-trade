import { NextRequest, NextResponse } from "next/server";
import { runAllAgents } from "@/lib/agents/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Called by the scheduler (see vercel.json). Requires `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await runAllAgents()) });
}
