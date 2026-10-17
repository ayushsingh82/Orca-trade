import type { Proposal } from "@/lib/risk/types";
import { quoteProposal } from "./pricing";

export type PaperFill = { units: number; price: number };
export type PaperPortfolio = { totalUsd: number; positionsUsd: Record<string, number>; cashUsd: number; pnlUsd: number; units: Record<string, number> };

/**
 * Paper execution: price the trade with a real Jupiter quote (real liquidity, real impact), but move
 * no funds. `units` is positive for buys and negative for sells.
 */
export async function paperFill(proposal: Proposal, usdPerUnit: number): Promise<PaperFill> {
  const priced = await quoteProposal(proposal, usdPerUnit);
  return { units: proposal.side === "buy" ? priced.units : -priced.units, price: priced.impliedPrice };
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
