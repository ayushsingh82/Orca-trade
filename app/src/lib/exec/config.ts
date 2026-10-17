/** Execution settings. Nothing is sent on-chain unless EXECUTION_ENABLED=1. */
export const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
export const EXECUTION_ENABLED = process.env.EXECUTION_ENABLED === "1";
export const GLOBAL_KILL = () => process.env.ORCA_GLOBAL_KILL === "1";
export const JUPITER_BASE = process.env.JUPITER_BASE ?? "https://lite-api.jup.ag/swap/v1";
export const PRIORITY_FEE_LAMPORTS = Number(process.env.PRIORITY_FEE_LAMPORTS ?? 0);
/** Mainnet-pilot ceiling: hard USD cap per trade for live agents, applied on top of each agent's own policy. 0 = no extra cap. */
export const PILOT_MAX_TRADE_USD = Number(process.env.PILOT_MAX_TRADE_USD ?? 0);
/** >0 routes swaps through the Jito block engine with this tip (lamports), so they land as private bundles. */
export const JITO_TIP_LAMPORTS = Number(process.env.JITO_TIP_LAMPORTS ?? 0);
export const JITO_URL = process.env.JITO_URL ?? "https://mainnet.block-engine.jito.wtf/api/v1";
