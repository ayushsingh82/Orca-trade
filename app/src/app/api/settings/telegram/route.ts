import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sendAlert } from "@/lib/alerts";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { chatId } = (await req.json().catch(() => ({}))) as { chatId?: string };
  const id = chatId?.trim() || null;
  if (id && !/^-?\d{4,20}$/.test(id)) return NextResponse.json({ ok: false, error: "chat id must be numeric" }, { status: 400 });
  await db().update(users).set({ telegramChatId: id }).where(eq(users.id, user.id));
  if (id) await sendAlert(id, "Orca alerts connected.");
  return NextResponse.json({ ok: true });
}
