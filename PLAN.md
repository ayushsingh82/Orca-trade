# Orca — Build Plan

## 1. What MarketMind already gives us (reference: github.com/ayushsingh82/MarketMind)

MarketMind is a **read-only** AI market-intelligence app: Next.js 16 / React 19 / Tailwind v4 / Recharts, with route handlers under `app/api/marketmind/*`. It never trades.

| MarketMind piece | File(s) | Reuse in Orca |
| --- | --- | --- |
| SoSoValue client (news, market snapshot, sectors, macro, SSI indices, ETF) with `x-soso-api-key`, mock fallback, `source` provenance field | `lib/sosovalue.ts`, `lib/mock.ts` | **Copy as-is** → Orca data layer |
| SoDEX read client (orderbook, trades, klines, perps mark/funding) → spread, depth imbalance, taker ratio | `lib/sodex.ts` | **Copy** → microstructure signals |
| Intelligence engine: news impact + decay, narrative momentum, contradiction detection | `lib/marketmind.ts`, `lib/analytics.ts` | **Copy + extend** → core of Layer 1 and the agent "gate" |
| LLM layer: grounded JSON response (thesis/causes/evidence/contradictions/confidence/citations), Anthropic → OpenAI-compatible fallback → templated fallback | `lib/llm.ts` | **Copy**, swap default to Claude, reuse the JSON schema for Decision Records |
| MarketMind Index + `autofund` handoff: target weights + conviction + risk flags as a signal payload (`marketmind.autofund.signal/v1`) | `lib/ssi.ts`, `app/api/marketmind/autofund/route.ts` | **Evolve** → the signal contract between Layer 1 and Layer 2 |
| UI shell: dashboard, ask, news, sectors, watchlist, charts, layout | `app/*`, `app/components/*` | **Copy shell**, restyle; add Agents/Portfolio pages |
| Polling hook | `lib/useLiveData.ts` | Reuse |

Things to **fix, not copy**: `lib/llm.ts` hardcodes an ephemeral RunPod URL (move to env), and MarketMind's design is "never execute" — Orca adds a whole execution layer, so the signal contract and safety model are new work.

Take the repo as a starting point: scaffold Orca fresh and port the `lib/` files, not a fork with its history.

## 2. Architecture

```
 SoSoValue ─┐                                   ┌─ Decision Record store
 SoDEX ─────┼─► Signal Engine ─► Agent Runtime ─┼─► Risk Engine (deterministic)
 Prices ────┘   (from MarketMind)   (LLM propose) │        │
                                                  │        ▼
                                                  └─► Execution Router ─► Smart wallet
                                                       quote·simulate·submit  (scoped signer)
```

- **Signal Engine**: MarketMind's engine, output = `OrcaSignal` (asset, direction, conviction 0–100, contradictions[], citations[], data snapshot id).
- **Agent Runtime**: per-agent loop on a schedule. Input: signals + portfolio + policy. LLM output: a *proposal* in strict JSON. Nothing executes here.
- **Risk Engine**: pure TypeScript, no LLM. Checks universe, per-trade/daily caps, max slippage, position concentration, contradiction severity, kill switch. Returns pass/fail with reasons.
- **Execution Router**: quote (DEX aggregator) → simulate → submit with scoped signer → confirm → write result to the Decision Record.
- **Storage**: Postgres (agents, policies, decisions, orders, snapshots).

## 3. Tech decisions (proposed defaults)

| Area | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 + TS + Tailwind v4 | Same as MarketMind → maximal reuse |
| DB | Postgres + Drizzle (Neon/Supabase) | Decision Records need relational history |
| Scheduler | Vercel Cron to start; later a worker (Inngest/BullMQ) | Agent loops |
| LLM | Claude via Anthropic SDK (prompt caching), JSON-schema output | Better grounding; MarketMind already has the provider fallback shape |
| Chain | **Solana** (devnet first) | Final decision: fast, cheap, deep spot liquidity |
| Wallet | Solana wallet-adapter (Phantom etc.) for the user; agent acts through a limited-authority signer (e.g. a smart-account program with spending limits such as Squads, or a managed delegated signer with policies). Pick at start of M4 | Enforceable scoped agent authority |
| Swaps | Jupiter swap API | Quote + transaction; simulate before send |
| Price feed for risk | Pyth | Sanity-check quotes vs. oracle |

## 4. Milestones

Each milestone ends in something demoable. Do them in order.

### M0 — Scaffold (½ day)
- `create-next-app` in `orca/app` (or repo root), Tailwind v4, env handling, lint.
- Port `lib/` from MarketMind; move the hardcoded LLM endpoint to env; default to Anthropic.
- **Done when:** `npm run dev` shows the MarketMind-style dashboard running on mock data under the Orca name.

### M1 — Intelligence layer (2–3 days)
- Wire real SoSoValue + SoDEX keys; keep mock fallback + `source` badge.
- Define `OrcaSignal` type and `/api/signals` (replaces the `autofund` route).
- Opportunity feed page: ranked signals with conviction, contradictions, citations.
- Ask Orca page (port `/ask`).
- **Done when:** feed shows ≥10 live-ranked opportunities, each with cited evidence.

### M2 — Agents in `observe` mode (3–4 days)
- DB schema: `agent`, `policy`, `decision`, `snapshot`.
- Agent create flow + 2 templates (Momentum, Narrative Rotation).
- Agent runtime loop → LLM proposal (strict JSON, validated with zod) → Risk Engine → Decision Record. No execution.
- Agents page + Decision log with full reasoning and risk-check results.
- Paper portfolio: simulated fills at quoted price to compute PnL.
- **Done when:** an agent runs hourly for 24h and builds a reviewable decision log with paper PnL.

### M3 — Risk Engine + Policy (2 days)
- Policy model: allowed assets, per-trade cap, daily cap, max slippage, max drawdown stop, min conviction, contradiction rule, expiry.
- Unit tests for every rule (this is the safety core; test it hardest).
- Kill switch (global + per-agent).
- **Done when:** test suite proves no proposal can bypass a limit, including malformed LLM output.

### M4 — Wallet + execution on testnet (4–5 days)
- Wallet connect + smart account creation; session-key grant UI (scope = policy), revoke button.
- Execution Router: quote → simulate → send → confirm; handle failure, reverts, partial state.
- `propose` mode: pending-approval queue (user taps approve).
- **Done when:** on Solana devnet, an agent proposal → user approves → real tx → Decision Record has the tx hash.

### M5 — Autonomous mode + portfolio (3 days)
- `autonomous` mode within session-key limits; auto-downgrade to `propose` on high-severity contradiction.
- Portfolio page: balances, positions, PnL, per-agent attribution, trade replay (snapshot → reasoning → tx).
- Alerts (email/Telegram) on every execution and every blocked action.
- **Done when:** an agent trades unattended on testnet for 48h within limits, with no policy violations.

### M6 — Hardening + mainnet-lite (3–4 days)
- Oracle sanity checks, slippage/MEV protection, retry/idempotency on orders, rate limits.
- Small-cap mainnet pilot (hard-coded low caps, allowlist).
- Landing page, demo video, docs.

**Order including product work:** M0 → M0.5 (accounts) → M1 → M2 → M3 → M4 → M5 → M6 → M7 (billing) → M8 (growth).

**Rough total:** ~3–4 weeks solo to testnet-complete; mainnet is the M6 pilot; billing adds ~1 week.

## 4b. Built for users, sold later (product + monetization)

Design for paying users from day one, but switch billing on only after M5. That means building accounts and entitlements now, and payments last.

### User journey
1. **Land** → public demo on mock/live read-only data (no signup). This is the top of the funnel.
2. **Sign up** → wallet sign-in (SIWE) or email. Free tier starts immediately.
3. **Explore** → opportunity feed, Ask Orca (daily limit).
4. **Create first agent** → pick a template, set a policy, run in `observe`/paper mode.
5. **Trust** → review the Decision log and paper PnL for a few days.
6. **Go live** → connect a Solana wallet, grant the agent a limited-authority signer, switch to `propose` then `autonomous`. Paid features start here.

### Tiers (placeholder prices, to be validated with users)
| | Free | Pro (~$29/mo) | Teams (~$199/mo) |
| --- | --- | --- | --- |
| Opportunity feed | Delayed / top 5 | Real-time, full | Real-time, full |
| Ask Orca | 5/day | 100/day | Unlimited (fair use) |
| Agents | 1, paper only | 5, live execution | 25, shared policies, roles |
| Modes | observe | observe, propose, autonomous | all + approvals workflow |
| Alerts | none | Email + Telegram | + webhooks / API |
| History | 7 days | 1 year | Unlimited + export |

Pricing model: **subscription with usage caps**. Do not take a performance fee or a cut of trades in v1. It needs custody/licensing review, and it conflicts with the non-custodial, advice-free positioning.

### Payments
- **Cards**: Stripe Checkout + Billing portal (subscriptions, trials, invoices). Webhooks update the user's plan.
- **Crypto**: pay in USDC on Solana, which fits the audience. An x402-style pay-per-call API is possible later for developers.
- **Entitlements**: a single `plan` + `limits` table checked server-side by one `can(user, feature)` helper. Gate by feature, never by hardcoded UI checks.

### Added data model
`user`, `subscription` (plan, status, period_end, provider), `usage` (user, metric, day, count), `api_key`, `audit_log`.

### Added milestones
- **M0.5 — Accounts (1–2 days):** auth (SIWE + email), user table, free-tier limits, usage counters. Do this right after scaffold so every later feature is entitlement-aware.
- **M7 — Billing (3–4 days, after M5):** Stripe subscriptions + webhooks, USDC payment option, upgrade/downgrade flow, paywall prompts at limits, billing page.
- **M8 — Growth (ongoing):** referral link, public agent leaderboard (paper PnL), shareable Decision Record pages, waitlist and onboarding email.

### Compliance to check before charging or going live on mainnet
- Disclaimers: not financial advice, trading risk, no guaranteed returns.
- Terms and privacy policy; geo-restrictions where needed.
- Confirm that a non-custodial software subscription avoids money-transmitter and advisory registration in your target markets. Get proper legal advice before mainnet or paid launch.

## 5. Safety rules (non-negotiable)
1. LLM output is a proposal only; the deterministic Risk Engine is the sole gate.
2. Limits enforced by the agent's on-chain signer authority, not just app code.
3. Non-custodial; no user private keys server-side; only the revocable, limited agent signer.
4. Default mode `observe`; autonomous requires explicit opt-in per agent.
5. Idempotent orders; every action logged to a Decision Record.
6. Testnet until M5 passes.

## 6. Open decisions for you
1. ~~Chain/venue~~ **Decided: Solana** (Jupiter for swaps).
2. **Data**: do you have a SoSoValue API key, or build on mock first?
3. **Submission target**: is this for a specific hackathon/deadline? That changes how much of M4–M6 we cut.
4. **Name/design system**: reuse the MarketMind look or a new one?

## 7. First actions
1. Answer the open decisions above (at least #1 and #3).
2. I scaffold `orca/app` and port MarketMind `lib/` (M0).
