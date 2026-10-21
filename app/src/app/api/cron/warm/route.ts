import { NextRequest, NextResponse } from "next/server";
import { buildLiveNewsImpacts, detectContradictions } from "@/lib/intel/marketmind";
import { getEtfFlows, getIndices, getSectorSpotlight, withSosoPatience } from "@/lib/intel/sosovalue";
import { buildMarketMindIndex } from "@/lib/intel/ssi";
import { getBots } from "@/lib/bots";
import { getSentiment } from "@/lib/sentiment";
import { buildSignals } from "@/lib/signals";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Fills the data caches ahead of visitors. SoSoValue allows ~10 requests a minute, and a cold server needs about 30
 * to build the Intelligence Board, so a first visitor would otherwise wait minutes. Call this every few minutes
 * (Vercel Cron once a day on Hobby; an external pinger such as cron-job.org for more) with
 * `Authorization: Bearer $CRON_SECRET`. With UPSTASH_REDIS_REST_* set, every server instance shares the result.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const steps: [string, () => Promise<unknown>][] = [
    ["signals", () => buildSignals()],
    ["sectors", () => getSectorSpotlight()],
    ["news", () => buildLiveNewsImpacts(10)],
    ["contradictions", () => detectContradictions()],
    ["sentiment", () => getSentiment()],
    ["bots", () => getBots()],
    ["index", () => buildMarketMindIndex()],
    ["indices", () => getIndices()],
    ["etf-btc", () => getEtfFlows("BTC", 14)],
    ["etf-eth", () => getEtfFlows("ETH", 14)],
  ];
  const started = Date.now();
  const result: Record<string, string> = {};
  await withSosoPatience(240_000, async () => {
    for (const [name, run] of steps) {
      if (Date.now() - started > 270_000) {
        result[name] = "skipped (out of time)";
        continue;
      }
      try {
        await run();
        result[name] = "ok";
      } catch (e) {
        result[name] = e instanceof Error ? e.message : "failed";
      }
    }
  });
  return NextResponse.json({ ok: true, seconds: Math.round((Date.now() - started) / 1000), result });
}
