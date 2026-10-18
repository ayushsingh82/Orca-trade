# Orca

**AI trading agents that show their work, and act on Solana only inside limits you set.**

Orca finds an opportunity, explains *why* with cited evidence, and, if you allow it, trades on-chain. Every action leaves a record you can replay: the data it saw, the reasoning, the risk checks, and the result.

---

## The problem

- **Research tools stop at insight.** You get charts and headlines, then switch to another app to act, after the move has decayed.
- **Trading bots act without evidence.** You can't see why they traded, and a bad model output can drain a wallet.

## The idea: two products, one loop

Orca combines two ideas that are each half a product:

| | Idea 1: AI crypto trading platform | Idea 2: autonomous AI trading agents | Orca |
| --- | --- | --- | --- |
| What it gives | Discover opportunities, analyze markets, execute | Agents that analyze, manage a portfolio and trade | Both, in one pipeline |
| What's missing | A safe way to act on the insight | Evidence you can audit before and after a trade | Every trade is backed by cited evidence and boxed in by hard limits |

Idea 1 is the **brain** (market intelligence). Idea 2 is the **hands** (agents that execute). Orca puts a strict, non-AI layer between them:

```
 Intelligence ──► Agents ──► Risk Engine ──► Execution
 discover +       decide      deterministic    Jupiter swap on Solana,
 analyze          (propose)   code, no LLM     limited-authority signer
 (cited, live)                                 + human approval if needed
```

**The rule that makes it safe: the AI proposes; plain code disposes.** No model output reaches a wallet without passing the Risk Engine.

## What you can do

| You want to... | Orca gives you |
| --- | --- |
| See what's worth attention right now | **Opportunities**: assets ranked by conviction, with direction, reasons, cited headlines and flagged contradictions |
| Understand a move | **Signal detail** and **Ask Orca**: cited answers grounded in live data, with the evidence that disagrees shown, not hidden |
| Automate a strategy | **Agents** from templates (Momentum, Narrative Rotation), each with its own limits |
| Trust before you risk money | **Paper trading**: a virtual $1,000 filled at real Jupiter quotes, with live PnL |
| Stay in control | Three modes per agent: **observe** (log only), **propose** (you approve each trade), **autonomous** (acts within limits) |
| Know what happened | **Decision log** (full record per run), **Portfolio** (value, positions, PnL) and **Telegram alerts** |

### How an agent decides

1. A scheduler (or **Run now**) wakes the agent.
2. It reads live signals plus its own book and policy.
3. Its strategy produces a **proposal** (buy or sell, which asset, how much) or does nothing.
4. The **Risk Engine** checks it against the policy: allowed assets, per-trade and daily caps, slippage, minimum conviction, concentration, kill switches, and cross-source contradictions.
5. Result: **reject**, **log only**, **queue for your approval**, or **execute**. A high-severity contradiction automatically downgrades an autonomous agent to asking you first.
6. A **Decision Record** is saved either way, and you get an alert.

## Why it's different

1. **Evidence-gated.** No trade without a cited record of why.
2. **Limits that are enforced, not promised.** The Risk Engine is deterministic and unit-tested (including malformed and hostile model output). Each agent's signer only holds what you fund it with.
3. **Contradictions matter.** When news, sector breadth, flow and macro disagree, Orca says so and acts more cautiously.
4. **Real data only.** No mock data and no templated theses. If a source is down you see an error or the last real response, never a fabricated number.
5. **Auditable.** Every trade can be replayed from data to decision to transaction.

## Who it's for

- Retail traders who stitch five tabs together to understand one move.
- Small funds and DAO treasuries that want policy-bound automation.
- Builders who want to fork an agent template.

## Plans

| | Free | Pro (~$29/mo) | Teams (~$199/mo) |
| --- | --- | --- | --- |
| Ask Orca | 5 / day | 100 / day | Unlimited (fair use) |
| Agents | 1, paper and observe only | 5, live execution | 25 |
| Modes | observe | observe, propose, autonomous | all |
| Alerts | No | Telegram | Telegram |

Limits are enforced server-side. Paid plans are sold through Stripe or Dodo Payments subscriptions, or by USDC; prices are placeholders to validate. Orca will not take a cut of trades or a performance fee.

## Where the code comes from

The intelligence layer is ported from MarketMind, a read-only research app that never trades. Orca keeps its SoSoValue and SoDEX clients, news-impact and contradiction engine, and grounded-LLM pattern (in `app/src/lib/intel/`), then adds what MarketMind deliberately lacked: accounts, agents, a risk engine, paper trading and execution. Details in [`app/plan.md`](app/plan.md).

## Architecture

```
SoSoValue ─┐                                       ┌─ Decision Records (Postgres)
SoDEX ─────┼─► Signal engine ─► Agent runtime ─────┤
Jupiter ───┘   (OrcaSignal)     (strategies)       └─► Risk Engine ─► Paper ledger
                                                                   └► Jupiter swap ─► Solana
```

| Layer | Where |
| --- | --- |
| Data and signals | `app/src/lib/intel/`, `app/src/lib/signals.ts` |
| Risk Engine and policy | `app/src/lib/risk/`, `app/src/lib/agents/policy.ts` |
| Strategies and runner | `app/src/lib/agents/` |
| Execution (Jupiter, signer, paper) | `app/src/lib/exec/` |
| Accounts and plan limits | `app/src/lib/auth/`, `app/src/lib/entitlements.ts` |
| Schema | `app/src/db/schema.ts` and `app/drizzle/` |

**Stack:** Next.js 16, React 19, Tailwind v4 (BestUI dark theme), Drizzle + Neon Postgres, Solana (`@solana/web3.js`, wallet standard), Jupiter swap API, `jose` sessions.

## Safety model

- **Non-custodial by design.** Your own wallet is never given to Orca. Each live agent has its own signer, encrypted at rest, that holds only the amount you send it. Exposure = what you fund + the Risk Engine limits.
- **Real sending is off by default.** Nothing goes on-chain unless `EXECUTION_ENABLED=1`. Otherwise swaps are quoted and simulated against real mainnet state.
- **Price guard.** Before any paper fill or swap, the Jupiter quote must be within the trade's slippage plus 150bps of an independent reference price (SoSoValue). Worse quotes are refused.
- **Approvals are re-checked.** Approving a queued trade re-runs the Risk Engine on fresh balances before anything swaps.
- **Kill switches.** Per agent, and platform-wide with `ORCA_GLOBAL_KILL=1`.
- **Known limit:** the server holds each agent signer's key. A Squads-based on-chain daily funding cap is designed and its instruction builders are written and tested, but it is not wired in or run on-chain yet. See [`docs/ONCHAIN_LIMITS.md`](docs/ONCHAIN_LIMITS.md).
- **Signal scoring is backtested, not proven.** `app/scripts/backtest.ts` showed 1-day momentum (the original driver) had a negative average, so direction now follows 7- and 14-day trend plus news. With ~450 daily observations nothing is statistically significant, and conviction is a ranking, not a probability.

> Not financial advice. Trading is risky and you can lose money. Start with paper trading and small amounts.

## Status

| Milestone | State |
| --- | --- |
| M0 Scaffold and BestUI theme | Done |
| M1 Intelligence: opportunities, signal detail, Ask Orca (Anthropic or OpenAI-compatible) | Built; Ask Orca needs an LLM key |
| M0.5 Accounts: Solana wallet and email sign-in, Neon, daily limits | Built; needs a database to run |
| M2 Agents: strategies, runner, Decision log, paper trading and PnL | Built; needs a database to run |
| M3 Risk Engine | Done, tested |
| M4 Solana execution: Jupiter, agent signer, approvals | Built; live sending off by default |
| M5 Scheduling, portfolio page, Telegram alerts | Built; scheduler needs `CRON_SECRET` |
| M6 Hardening: price guard against an independent reference, 429 retry, priority fee option, mainnet pilot cap | Built: price guard (live-tested), Jito bundle sending (tx build verified against Jupiter and Jito; sending untested). Not done: Pyth |
| M7 Billing: Stripe checkout, portal, webhook, billing page | Built; Stripe needs keys and prices; USDC payments verified on-chain (logic tested, never run live) |
| M8 Growth: referral links, opt-in public leaderboard, shareable Decision Records | Built; referral rewards (30 days of Pro per paying referral, max 12) need the database to run |

## Run it

```bash
cd app
cp .env.example .env.local     # then fill in the values below
npm install
npx drizzle-kit migrate        # creates the tables in your Neon database
npm run dev                    # http://localhost:3000
npm test                       # Risk Engine, strategies, paper ledger
```

| Variable | Needed for |
| --- | --- |
| `SOSO_API_KEY` | Live market, news and sector data |
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET`, `AGENT_KEY_SECRET` | Sessions and agent-signer encryption (32+ chars each) |
| `ANTHROPIC_API_KEY` or `OPENAI_BASE_URL` + `OPENAI_MODEL` + `OPENAI_API_KEY` | Ask Orca |
| `CRON_SECRET` | Hourly agent runs (`vercel.json`) |
| `TELEGRAM_BOT_TOKEN` | Alerts (optional) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAMS` | Billing |
| `PILOT_MAX_TRADE_USD` | Optional hard USD cap per trade on every live agent |
| `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENV`, `DODO_PRODUCT_PRO`, `DODO_PRODUCT_TEAMS` | Billing through Dodo (optional, shows a second button) |
| `TREASURY_WALLET` | Receives USDC subscription payments |
| `JITO_TIP_LAMPORTS` | Optional: send swaps as tipped Jito bundles |
| `EXECUTION_ENABLED=1` | Real on-chain sending (leave off until you are ready) |

## Docs

| File | What it covers |
| --- | --- |
| [`IDEA.md`](IDEA.md) | Product concept, layers, differentiators, non-goals |
| [`PLAN.md`](PLAN.md) | Architecture, tech choices, milestones, tiers and billing, safety rules |
| [`app/plan.md`](app/plan.md) | How we execute, MarketMind mapping, live status |
