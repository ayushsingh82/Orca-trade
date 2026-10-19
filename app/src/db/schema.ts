import { boolean, date, doublePrecision, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Check, Policy, Proposal, Verdict } from "@/lib/risk/types";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  /** Base58 Solana public key. */
  wallet: text("wallet").unique(),
  plan: text("plan", { enum: ["free", "pro", "teams"] }).notNull().default("free"),
  /** Telegram chat id for alerts (optional). */
  telegramChatId: text("telegram_chat_id"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  dodoSubscriptionId: text("dodo_subscription_id").unique(),
  referralCode: text("referral_code").unique(),
  /** Referral code of whoever invited this user. */
  referredBy: text("referred_by"),
  /** Paid plan bought with USDC runs until this time (null = managed by Stripe or free). */
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  /** Pro access earned through referrals runs until this time. */
  bonusProUntil: timestamp("bonus_pro_until", { withTimezone: true }),
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

export const STRATEGIES = ["momentum", "narrative_rotation", "rsi_reversion"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  strategy: text("strategy", { enum: STRATEGIES }).notNull(),
  policy: jsonb("policy").$type<Policy>().notNull(),
  /** Paper agents trade virtual USDC at real quoted prices and never touch the chain. */
  paper: boolean("paper").notNull().default(true),
  paperStartUsd: doublePrecision("paper_start_usd").notNull().default(1000),
  /** Opt-in: show this (paper) agent on the public leaderboard. */
  listed: boolean("listed").notNull().default(false),
  /** The agent's limited-authority signer. It only ever holds what the user funds it with. */
  walletPublicKey: text("wallet_public_key").notNull(),
  walletSecretEnc: text("wallet_secret_enc").notNull(),
  /** Optional on-chain funding cap: a Squads vault the user controls plus one daily spending limit for this agent. */
  squadsOwner: text("squads_owner"),
  squadsMultisig: text("squads_multisig"),
  squadsLimit: text("squads_limit"),
  squadsDailyUsdc: doublePrecision("squads_daily_usdc"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const DECISION_STATUS = ["logged", "rejected", "pending", "paper", "executed", "simulated", "failed"] as const;
export type DecisionStatus = (typeof DECISION_STATUS)[number];

/** One row per agent run: the full replayable record (signals, reasoning, risk checks, outcome). */
export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Opt-in: anyone with the link can view this decision at /d/[id]. */
  shared: boolean("shared").notNull().default(false),
  signalSource: text("signal_source").notNull(),
  rationale: jsonb("rationale").$type<string[]>().notNull(),
  citations: jsonb("citations").$type<{ id: string; title: string; source: string }[]>().notNull(),
  proposal: jsonb("proposal").$type<Proposal | null>(),
  verdict: text("verdict").$type<Verdict>().notNull(),
  checks: jsonb("checks").$type<Check[]>().notNull(),
  status: text("status", { enum: DECISION_STATUS }).notNull(),
  /** USD notional that actually moved; counts toward the daily cap. */
  executedUsd: doublePrecision("executed_usd").notNull().default(0),
  /** Paper fills: units of the asset bought (+) or sold (-), and the real quoted price. */
  fillUnits: doublePrecision("fill_units"),
  fillPrice: doublePrecision("fill_price"),
  txSignature: text("tx_signature"),
  error: text("error"),
});

export type Agent = typeof agents.$inferSelect;
export type Decision = typeof decisions.$inferSelect;

/** One reward per referred user, granted when they first become a paying customer. */
export const referralRewards = pgTable("referral_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  referredUserId: uuid("referred_user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  daysGranted: integer("days_granted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** USDC subscription payments. `reference` is a unique account key the payer must include so the transfer can be found on-chain. */
export const usdcPayments = pgTable("usdc_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan", { enum: ["pro", "teams"] }).notNull(),
  amountUsdc: doublePrecision("amount_usdc").notNull(),
  reference: text("reference").notNull().unique(),
  signature: text("signature").unique(),
  status: text("status", { enum: ["pending", "paid", "expired"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
