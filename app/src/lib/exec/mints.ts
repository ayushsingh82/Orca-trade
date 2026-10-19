/** Tradable assets on Solana mainnet. Agents hold USDC as the base and trade it against these. */
export const USDC = { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 } as const;

export type TokenRisk = "core" | "standard" | "high";
export type TradableToken = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  /** CoinGecko id, used for the independent reference price and the research pages. */
  cgId: string;
  /** core: large caps. standard: established Solana tokens. high: memecoins and very volatile tokens. */
  risk: TokenRisk;
};

/**
 * The only tokens an agent may ever trade. A static, reviewed list on purpose: a mint address is money, so it is
 * never taken from a search result at run time. Each entry was checked against Jupiter's verified token list
 * (same symbol, verified, price within 5% of CoinGecko) and has at least $2M of on-chain liquidity.
 * Re-check with `npx tsx scripts/verify-tokens.ts` before adding or trusting an entry.
 */
const LIST: TradableToken[] = [
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", decimals: 9, cgId: "solana", risk: "core" },
  { symbol: "BTC", name: "Bitcoin (Wormhole)", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8, cgId: "bitcoin", risk: "core" }, // Wormhole wBTC
  { symbol: "ETH", name: "Ethereum (Wormhole)", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, cgId: "ethereum", risk: "core" }, // Wormhole wETH
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, cgId: "jupiter-exchange-solana", risk: "standard" },
  { symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, cgId: "raydium", risk: "standard" },
  { symbol: "KMNO", name: "Kamino", mint: "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS", decimals: 6, cgId: "kamino", risk: "standard" },
  { symbol: "PUMP", name: "Pump.fun", mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn", decimals: 6, cgId: "pump-fun", risk: "high" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, cgId: "bonk", risk: "high" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, cgId: "dogwifcoin", risk: "high" },
  { symbol: "TRUMP", name: "Official Trump", mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", decimals: 6, cgId: "official-trump", risk: "high" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", decimals: 9, cgId: "popcat", risk: "high" },
  { symbol: "PENGU", name: "Pudgy Penguins", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", decimals: 6, cgId: "pudgy-penguins", risk: "high" },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", decimals: 5, cgId: "cat-in-a-dogs-world", risk: "high" },
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", decimals: 6, cgId: "fartcoin", risk: "high" },
];

export const TRADABLE: TradableToken[] = LIST;
/** Symbol -> token. Kept under the old name so existing code keeps working. */
export const TOKENS: Record<string, TradableToken> = Object.fromEntries(LIST.map((t) => [t.symbol, t]));
/** The large caps an agent may trade by default. Everything else is an explicit opt-in. */
export const CORE_SYMBOLS = LIST.filter((t) => t.risk === "core").map((t) => t.symbol);

export const isTradable = (symbol: string) => symbol.toUpperCase() in TOKENS;
export const tokenBySymbol = (symbol: string) => TOKENS[symbol.toUpperCase()];
export const tokenByCgId = (id: string) => LIST.find((t) => t.cgId === id);
