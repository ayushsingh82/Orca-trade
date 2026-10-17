import { NextResponse } from "next/server";
import { buildSignals } from "@/lib/signals";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  const data = await buildSignals();
  return NextResponse.json({ ok: true, data, source: data.source, generatedAt: data.generatedAt });
}
