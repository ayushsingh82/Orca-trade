/** Execution settings. Nothing is sent on-chain unless EXECUTION_ENABLED=1. */
export const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
export const EXECUTION_ENABLED = process.env.EXECUTION_ENABLED === "1";
export const GLOBAL_KILL = () => process.env.ORCA_GLOBAL_KILL === "1";
export const JUPITER_BASE = process.env.JUPITER_BASE ?? "https://lite-api.jup.ag/swap/v1";
