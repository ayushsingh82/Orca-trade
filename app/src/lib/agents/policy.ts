import type { AgentMode, Policy } from "@/lib/risk/types";
import { TOKENS } from "@/lib/exec/mints";

export const DEFAULT_POLICY: Policy = {
  mode: "observe",
  allowedAssets: Object.keys(TOKENS),
  maxTradeUsd: 25,
  maxDailyUsd: 100,
  maxSlippageBps: 50,
  minConviction: 60,
  maxPositionPct: 40,
  downgradeAtRisk: "high",
  rejectAtRisk: null,
  expiresAt: null,
  killSwitch: false,
};

const MODES: AgentMode[] = ["observe", "propose", "autonomous"];

/** Validates a user-submitted policy. Hard ceilings stop a bad form from creating an unsafe agent. */
export function parsePolicy(raw: unknown): Policy | string {
  const r = (raw ?? {}) as Partial<Policy>;
  const p: Policy = { ...DEFAULT_POLICY, ...r };
  const num = (n: unknown, lo: number, hi: number) => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;

  if (!MODES.includes(p.mode)) return "invalid mode";
  if (!Array.isArray(p.allowedAssets) || p.allowedAssets.length === 0) return "allowedAssets required";
  p.allowedAssets = p.allowedAssets.map((a) => String(a).toUpperCase());
  if (p.allowedAssets.some((a) => !(a in TOKENS))) return "allowedAssets contains an untradable asset";
  if (!num(p.maxTradeUsd, 1, 10_000)) return "maxTradeUsd must be 1-10000";
  if (!num(p.maxDailyUsd, p.maxTradeUsd, 100_000)) return "maxDailyUsd must be >= maxTradeUsd";
  if (!num(p.maxSlippageBps, 1, 300)) return "maxSlippageBps must be 1-300";
  if (!num(p.minConviction, 0, 100)) return "minConviction must be 0-100";
  if (!num(p.maxPositionPct, 1, 100)) return "maxPositionPct must be 1-100";
  if (!["low", "medium", "high"].includes(p.downgradeAtRisk)) return "invalid downgradeAtRisk";
  if (p.rejectAtRisk !== null && !["low", "medium", "high"].includes(p.rejectAtRisk)) return "invalid rejectAtRisk";
  p.killSwitch = Boolean(p.killSwitch);
  p.expiresAt = typeof p.expiresAt === "number" && Number.isFinite(p.expiresAt) ? p.expiresAt : null;
  return p;
}
