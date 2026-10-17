export type AgentMode = "observe" | "propose" | "autonomous";
export type RiskFlag = "none" | "low" | "medium" | "high";

/** User-defined limits. Enforced by the Risk Engine and, at execution time, by the signer's on-chain authority. */
export type Policy = {
  mode: AgentMode;
  allowedAssets: string[];
  maxTradeUsd: number;
  maxDailyUsd: number;
  maxSlippageBps: number;
  minConviction: number; // 0..100
  /** Largest share of portfolio value one asset may reach after a buy, in percent. */
  maxPositionPct: number;
  /** Contradiction severity at or above which an autonomous agent drops to human approval. */
  downgradeAtRisk: Exclude<RiskFlag, "none">;
  /** Contradiction severity at or above which the trade is rejected outright. null = never. */
  rejectAtRisk: Exclude<RiskFlag, "none"> | null;
  /** Epoch ms after which the policy no longer authorises anything. null = no expiry. */
  expiresAt: number | null;
  killSwitch: boolean;
};

/** What an agent wants to do. Comes from an LLM or strategy, so it is untrusted until parsed and evaluated. */
export type Proposal = {
  asset: string;
  side: "buy" | "sell";
  sizeUsd: number;
  maxSlippageBps: number;
  conviction: number;
  riskFlag: RiskFlag;
};

export type RiskContext = {
  now: number;
  spentTodayUsd: number;
  portfolioValueUsd: number;
  /** Current USD value held in the proposal's asset. */
  positionUsd: number;
  /** Platform-wide kill switch. */
  globalKill: boolean;
};

export type Check = { rule: string; passed: boolean; detail: string };

export type Verdict =
  | "reject" // do nothing
  | "log_only" // observe mode: record the decision, never execute
  | "needs_approval" // queue for a human
  | "allow"; // may be executed within the signer's authority

export type Evaluation = { verdict: Verdict; checks: Check[] };
