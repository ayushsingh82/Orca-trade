import type { Proposal } from "@/lib/risk/types";
import { getQuote, type JupiterQuote } from "./jupiter";
import { TOKENS, USDC } from "./mints";

/** Extra tolerance on top of the trade's own slippage cap. Covers reference-price staleness (cached up to ~3 min). */
const ORACLE_TOLERANCE_BPS = Number(process.env.ORACLE_TOLERANCE_BPS ?? 150);

export type PricedQuote = {
  quote: JupiterQuote;
  inputMint: string;
  /** Units of the traded asset received (buy) or sold (sell). */
  units: number;
  /** USD per unit actually implied by the quote. */
  impliedPrice: number;
};

/**
 * Pure guard: refuses a quote whose implied price strays from an independent reference price by more
 * than the allowed band. Protects against a manipulated or illiquid route, and against bad reference data.
 */
export function assertQuoteSane(args: { side: "buy" | "sell"; impliedPrice: number; referencePrice: number; maxSlippageBps: number; toleranceBps?: number }) {
  const { side, impliedPrice, referencePrice, maxSlippageBps, toleranceBps = ORACLE_TOLERANCE_BPS } = args;
  if (!(referencePrice > 0) || !Number.isFinite(referencePrice)) throw new Error("price check failed: no valid reference price");
  if (!(impliedPrice > 0) || !Number.isFinite(impliedPrice)) throw new Error("price check failed: quote has no valid price");
  const allowed = maxSlippageBps + toleranceBps;
  // Only the adverse direction matters: paying more than reference (buy) or receiving less (sell).
  const adverseBps = side === "buy" ? ((impliedPrice - referencePrice) / referencePrice) * 1e4 : ((referencePrice - impliedPrice) / referencePrice) * 1e4;
  if (adverseBps > allowed) {
    throw new Error(
      `price check failed: quote is ${adverseBps.toFixed(0)}bps worse than reference $${referencePrice.toFixed(2)} (allowed ${allowed}bps)`,
    );
  }
}

/** Quotes a proposal against Jupiter and verifies the price against the independent reference. */
export async function quoteProposal(proposal: Proposal, referencePrice: number): Promise<PricedQuote> {
  const token = TOKENS[proposal.asset.toUpperCase()];
  if (!token) throw new Error(`${proposal.asset} is not tradable via Orca`);
  if (!(referencePrice > 0)) throw new Error("no live price for sizing");

  const buy = proposal.side === "buy";
  const input = buy ? USDC : token;
  const output = buy ? token : USDC;
  const inUnits = buy ? proposal.sizeUsd : proposal.sizeUsd / referencePrice;
  const amount = BigInt(Math.floor(inUnits * 10 ** input.decimals));
  if (amount <= BigInt(0)) throw new Error("trade size rounds to zero");

  const quote = await getQuote({ inputMint: input.mint, outputMint: output.mint, amount, slippageBps: proposal.maxSlippageBps });
  const out = Number(quote.outAmount) / 10 ** output.decimals;
  if (!(out > 0)) throw new Error("quote returned no output");

  const units = buy ? out : inUnits;
  const impliedPrice = buy ? proposal.sizeUsd / out : out / inUnits;
  assertQuoteSane({ side: proposal.side, impliedPrice, referencePrice, maxSlippageBps: proposal.maxSlippageBps });
  return { quote, inputMint: input.mint, units, impliedPrice };
}
