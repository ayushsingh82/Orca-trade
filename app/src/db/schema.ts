import { date, doublePrecision, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Check, Policy, Proposal, Verdict } from "@/lib/risk/types";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  /** Base58 Solana public key. */
  wallet: text("wallet").unique(),
  plan: text("plan", { enum: ["free", "pro", "teams"] }).notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user, per-metric, per-UTC-day counters used for plan limits. */
export const usage = pgTable(
  "usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    day: date("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.metric, t.day] })],
);

export type User = typeof users.$inferSelect;

export const STRATEGIES = ["momentum", "narrative_rotation"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  strategy: text("strategy", { enum: STRATEGIES }).notNull(),
  policy: jsonb("policy").$type<Policy>().notNull(),
  /** The agent's limited-authority signer. It only ever holds what the user funds it with. */
  walletPublicKey: text("wallet_public_key").notNull(),
  walletSecretEnc: text("wallet_secret_enc").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const DECISION_STATUS = ["logged", "rejected", "pending", "executed", "simulated", "failed"] as const;
export type DecisionStatus = (typeof DECISION_STATUS)[number];

/** One row per agent run: the full replayable record (signals, reasoning, risk checks, outcome). */
export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  signalSource: text("signal_source").notNull(),
  rationale: jsonb("rationale").$type<string[]>().notNull(),
  citations: jsonb("citations").$type<{ id: string; title: string; source: string }[]>().notNull(),
  proposal: jsonb("proposal").$type<Proposal | null>(),
  verdict: text("verdict").$type<Verdict>().notNull(),
  checks: jsonb("checks").$type<Check[]>().notNull(),
  status: text("status", { enum: DECISION_STATUS }).notNull(),
  /** USD notional that actually moved; counts toward the daily cap. */
  executedUsd: doublePrecision("executed_usd").notNull().default(0),
  txSignature: text("tx_signature"),
  error: text("error"),
});

export type Agent = typeof agents.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
