import { JITO_TIP_LAMPORTS, JUPITER_BASE, PRIORITY_FEE_LAMPORTS } from "./config";

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

/** Jupiter's free tier rate-limits (429). Retry with backoff; any other error fails immediately. */
async function jup<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${JUPITER_BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(15_000), ...init });
    if (res.ok) return (await res.json()) as T;
    lastError = `Jupiter ${res.status} on ${path.split("?")[0]}: ${(await res.text()).slice(0, 120)}`;
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
  }
  throw new Error(lastError);
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
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      dynamicComputeUnitLimit: true,
      // A Jito tip (bundle path) takes precedence over a plain priority fee.
      ...(JITO_TIP_LAMPORTS > 0
        ? { prioritizationFeeLamports: { jitoTipLamports: JITO_TIP_LAMPORTS } }
        : PRIORITY_FEE_LAMPORTS > 0
          ? { prioritizationFeeLamports: PRIORITY_FEE_LAMPORTS }
          : {}),
    }),
  });
  return r.swapTransaction;
}
