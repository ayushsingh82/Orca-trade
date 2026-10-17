/** Tradable assets on Solana mainnet. Agents hold USDC as the base and trade it against these. */
export const USDC = { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 } as const;

export const TOKENS: Record<string, { symbol: string; mint: string; decimals: number }> = {
  SOL: { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  BTC: { symbol: "BTC", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8 }, // Wormhole wBTC
  ETH: { symbol: "ETH", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8 }, // Wormhole wETH
};

export const isTradable = (symbol: string) => symbol.toUpperCase() in TOKENS;
