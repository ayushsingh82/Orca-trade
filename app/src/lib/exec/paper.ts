import type { Proposal } from "@/lib/risk/types";
import { getQuote } from "./jupiter";
import { TOKENS, USDC } from "./mints";

export type PaperFill = { units: number; price: number };
export type PaperPortfolio = { totalUsd: number; positionsUsd: Record<string, number>; cashUsd: number; pnlUsd: number; units: Record<string, number> };

/**
 * Paper execution: price the trade with a real Jupiter quote (real liquidity, real impact), but move
 * no funds. `units` is positive for buys and negative for sells.
 */
export async function paperFill(proposal: Proposal, usdPerUnit: number): Promise<PaperFill> {
  const token = TOKENS[proposal.asset.toUpperCase()];
  if (!token) throw new Error(`${proposal.asset} is not tradable via Orca`);
  if (!(usdPerUnit > 0)) throw new Error("no live price for sizing");

  if (proposal.side === "buy") {
    const quote = await getQuote({
      inputMint: USDC.mint,
      outputMint: token.mint,
      amount: BigInt(Math.floor(proposal.sizeUsd * 10 ** USDC.decimals)),
      slippageBps: proposal.maxSlippageBps,
    });
    const units = Number(quote.outAmount) / 10 ** token.decimals;
    if (!(units > 0)) throw new Error("quote returned no output");
    return { units, price: proposal.sizeUsd / units };
  }
  const sellUnits = proposal.sizeUsd / usdPerUnit;
  const quote = await getQuote({
    inputMint: token.mint,
    outputMint: USDC.mint,
    amount: BigInt(Math.floor(sellUnits * 10 ** token.decimals)),
    slippageBps: proposal.maxSlippageBps,
  });
  const usdOut = Number(quote.outAmount) / 10 ** USDC.decimals;
  if (!(usdOut > 0)) throw new Error("quote returned no output");
  return { units: -sellUnits, price: usdOut / sellUnits };
}

type Fill = { proposal: { asset: string; side: "buy" | "sell"; sizeUsd: number } | null; status: string; fillUnits: number | null; fillPrice: number | null };

/** Rebuilds a paper agent's book from its fill ledger and marks it to market with live prices. */
export function paperPortfolio(startUsd: number, fills: Fill[], priceUsd: Record<string, number>): PaperPortfolio {
  let cash = startUsd;
  const units: Record<string, number> = {};
  for (const f of fills) {
    if (f.status !== "paper" || !f.proposal || f.fillUnits == null || f.fillPrice == null) continue;
    const asset = f.proposal.asset.toUpperCase();
    units[asset] = (units[asset] ?? 0) + f.fillUnits;
    cash -= f.fillUnits * f.fillPrice; // buys cost cash, sells (negative units) return it
  }
  const positionsUsd: Record<string, number> = {};
  for (const [asset, u] of Object.entries(units)) positionsUsd[asset] = u * (priceUsd[asset] ?? 0);
  const totalUsd = cash + Object.values(positionsUsd).reduce((a, b) => a + b, 0);
  return { totalUsd, positionsUsd, cashUsd: cash, pnlUsd: totalUsd - startUsd, units };
}
