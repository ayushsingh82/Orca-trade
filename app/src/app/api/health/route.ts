import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness plus a database ping, for uptime monitors and deploy checks. Reveals no configuration values. */
export async function GET() {
  const checks: Record<string, boolean> = { dataKey: Boolean(process.env.SOSO_API_KEY), sessions: Boolean(process.env.AUTH_SECRET), signerKey: Boolean(process.env.AGENT_KEY_SECRET) };
  try {
    await db().execute(sql`select 1`);
    checks.database = true;
  } catch {
    checks.database = false;
  }
  const ok = checks.database;
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
