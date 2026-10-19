import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentTransfers, agents, decisions } from "@/db/schema";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const cell = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const s = v === null || v === undefined ? "" : String(v);
  // Quote anything with a delimiter, and neutralise spreadsheet formulas in text (numbers are left alone).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The signed-in user's trade and withdrawal history as CSV. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const mine = await db().select().from(agents).where(eq(agents.userId, user.id));
  const ids = mine.map((a) => a.id);
  const name = new Map(mine.map((a) => [a.id, a]));
  const [trades, moves] = ids.length
    ? await Promise.all([
        db().select().from(decisions).where(inArray(decisions.agentId, ids)).orderBy(desc(decisions.createdAt)).limit(5000),
        db().select().from(agentTransfers).where(eq(agentTransfers.userId, user.id)).orderBy(desc(agentTransfers.createdAt)).limit(5000),
      ])
    : [[], []];

  const rows: unknown[][] = [["time", "agent", "type", "status", "side", "asset", "size_usd", "units", "price", "transaction"]];
  for (const d of trades) {
    if (!d.proposal) continue;
    const a = name.get(d.agentId);
    rows.push([d.createdAt.toISOString(), a?.name, a?.paper ? "paper" : "live", d.status, d.proposal.side, d.proposal.asset, d.proposal.sizeUsd, d.fillUnits, d.fillPrice, d.txSignature]);
  }
  for (const t of moves) rows.push([t.createdAt.toISOString(), name.get(t.agentId)?.name, "withdrawal", "sent", "", t.asset, "", t.amount, "", t.signature]);
  rows.sort((a, b) => (a === rows[0] ? -1 : b === rows[0] ? 1 : String(b[0]).localeCompare(String(a[0]))));
  const csv = rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="orca-history.csv"', "cache-control": "no-store" } });
}
