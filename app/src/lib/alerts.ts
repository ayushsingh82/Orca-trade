/** Telegram alerts. Silent no-op when TELEGRAM_BOT_TOKEN or the user's chat id is missing; never throws. */
export async function sendAlert(chatId: string | null | undefined, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    /* alerts are best-effort */
  }
}
