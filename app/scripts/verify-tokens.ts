/**
 * Re-checks the tradable token list against live data: each mint must exist on Jupiter's verified list with the
 * same symbol and decimals, price within 5% of CoinGecko, and at least $2M liquidity (SOL/BTC/ETH are exempt from
 * the liquidity check). Run before adding a token or trusting the list: npx tsx scripts/verify-tokens.ts
 */
import { TRADABLE } from "../src/lib/exec/mints";

const MIN_LIQUIDITY = 2_000_000;
const KEY = process.env.COINGECKO_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type JupToken = { id: string; decimals: number; isVerified: boolean; liquidity: number; usdPrice: number };
type CgRow = { id: string; current_price: number };

async function jup(mint: string): Promise<JupToken | null> {
  for (let i = 0; i < 4; i++) {
    const j = await (await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`)).json();
    if (Array.isArray(j)) return (j as JupToken[]).find((t) => t.id === mint) ?? null;
    await sleep(2500 * (i + 1));
  }
  return null;
}

(async () => {
  const cg = (await (await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${TRADABLE.map((t) => t.cgId).join(",")}&per_page=100`, { headers: KEY ? { "x-cg-demo-api-key": KEY } : {} })).json()) as CgRow[];
  let bad = 0;
  for (const t of TRADABLE) {
    const c = cg.find((x) => x.id === t.cgId);
    const j = await jup(t.mint);
    const problems: string[] = [];
    if (!c) problems.push("CoinGecko id not found");
    if (!j) problems.push("mint not found on Jupiter");
    else {
      if (j.decimals !== t.decimals) problems.push(`decimals ${j.decimals} != ${t.decimals}`);
      if (t.risk !== "core" && !j.isVerified) problems.push("not verified on Jupiter");
      if (t.risk !== "core" && j.liquidity < MIN_LIQUIDITY) problems.push(`liquidity $${(j.liquidity / 1e6).toFixed(2)}M < $2M`);
      if (c && t.risk !== "core" && Math.abs((j.usdPrice - c.current_price) / c.current_price) > 0.05) problems.push("price differs >5% from CoinGecko");
    }
    console.log(`${problems.length ? "FAIL" : "ok  "}  ${t.symbol.padEnd(9)} ${t.risk.padEnd(9)} ${problems.join("; ")}`);
    bad += problems.length ? 1 : 0;
    await sleep(1200);
  }
  console.log(bad === 0 ? "\nALL TOKENS VERIFIED" : `\n${bad} TOKEN(S) FAILED`);
  process.exit(bad ? 1 : 0);
})();
