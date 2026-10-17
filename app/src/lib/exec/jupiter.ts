import { JUPITER_BASE } from "./config";

export type JupiterQuote = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: string;
  [k: string]: unknown;
};

async function jup<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${JUPITER_BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(15_000), ...init });
  if (!res.ok) throw new Error(`Jupiter ${res.status} on ${path.split("?")[0]}: ${(await res.text()).slice(0, 120)}`);
  return (await res.json()) as T;
}

export function getQuote(args: { inputMint: string; outputMint: string; amount: bigint; slippageBps: number }) {
  const q = new URLSearchParams({
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: args.amount.toString(),
    slippageBps: String(Math.round(args.slippageBps)),
  });
  return jup<JupiterQuote>(`/quote?${q}`);
}

/** Returns a base64 versioned transaction for the quote, to be signed by the agent signer. */
export async function buildSwapTransaction(quote: JupiterQuote, userPublicKey: string) {
  const r = await jup<{ swapTransaction: string }>("/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey, dynamicComputeUnitLimit: true }),
  });
  return r.swapTransaction;
}
