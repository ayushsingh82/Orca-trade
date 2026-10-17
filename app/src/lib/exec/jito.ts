import type { VersionedTransaction } from "@solana/web3.js";
import { JITO_URL } from "./config";

async function rpc<T>(path: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(`${JITO_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!res.ok || !json || json.error) throw new Error(`Jito ${method} failed: ${json?.error?.message ?? res.status}`);
  return json.result as T;
}

export const getTipAccounts = () => rpc<string[]>("/bundles", "getTipAccounts", []);

/** Pure: does the transaction reference at least one Jito tip account? A bundle-only send without a tip never lands. */
export function hasTip(tx: Pick<VersionedTransaction, "message">, tipAccounts: string[]): boolean {
  const tips = new Set(tipAccounts);
  return tx.message.staticAccountKeys.some((k) => tips.has(k.toBase58()));
}

/**
 * Sends a signed transaction to the Jito block engine as bundle-only, so it is not broadcast to the
 * public network where it could be sandwiched. Returns the transaction signature.
 */
export async function sendViaJito(tx: VersionedTransaction): Promise<string> {
  const tips = await getTipAccounts();
  if (!hasTip(tx, tips)) throw new Error("refusing to send via Jito: transaction has no tip transfer");
  return rpc<string>("/transactions?bundleOnly=true", "sendTransaction", [Buffer.from(tx.serialize()).toString("base64"), { encoding: "base64" }]);
}
