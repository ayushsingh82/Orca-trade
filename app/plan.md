# Orca app — execution plan & status

Product plan lives one level up: `../IDEA.md` (what) and `../PLAN.md` (milestones, tiers, billing). This file is the *how we execute* doc for the app in this folder, in the same spirit as MarketMind's own `plan.md`.

## How we execute

1. **One milestone at a time**, each ending demoable and passing `tsc`, `eslint`, `next build`.
2. **Port, don't fork.** MarketMind code is copied into `src/lib/intel/` as a frozen engine with minimal edits (env-config only). Orca-specific logic lives *outside* it (`src/lib/signals.ts`, later `agents/`, `risk/`, `exec/`). This keeps the engine upgradable and the new work obvious.
3. **LLM proposes, deterministic code disposes.** No execution path may depend on LLM output without passing the Risk Engine.
4. **Honest provenance.** Every payload carries a `source` string (live vs. mock); the UI shows it.
5. **Real data only.** No mock fallbacks and no templated theses; if a source is down we show an error, or the last real response.
6. **UI = BestUI theme exactly** (`src/app/globals.css` tokens: bg `#151515`, card `#1a1a1a`, muted `#1e1e1e`, border white/8%, violet accent; Geist + Bricolage Grotesque; dark-only).
7. **Secrets only via env** (`.env.local`, gitignored). Never hardcoded.

## How we take inspiration from MarketMind

| MarketMind | What we keep | What we change |
| --- | --- | --- |
| `lib/sosovalue.ts` | Client, auth header, mock fallback, `source` field | API key moved to `SOSO_API_KEY` env (MarketMind hardcoded it) |
| `lib/sodex.ts` | Read-only microstructure (spread, depth, taker ratio, funding) | Unchanged for now; SoDEX stays a data source, execution venue TBD |
| `lib/marketmind.ts`, `analytics.ts` | News impact + decay, narratives, contradiction detection | Contradictions become a *gate* on agents, not just a display |
| `lib/llm.ts` | Grounded-JSON prompt + defensive `coerceAnalysis` | Endpoint from env; unset => templated fallback. Will add Anthropic provider |
| `lib/ssi.ts` (MMX index) | Constituent universe + prices/changes as the asset universe | Becomes the asset universe for signals |
| `api/marketmind/autofund` | Idea of a structured handoff payload | Replaced by `OrcaSignal` (`src/lib/signals.ts`, `/api/signals`) |
| UI pages (dashboard/ask/news/…) | Information architecture, card patterns | Restyled to BestUI theme; reorganised around Opportunities → Agents → Portfolio |
| "Never trades" stance | Honesty, citations, mock fallbacks | **Reversed**: Orca executes, but only inside a policy-bound, non-custodial session key |

Files ported live in `src/lib/intel/`: `analytics, llm, marketmind, mock, sodex, sosovalue, ssi, types`. Not yet ported: Ask Orca page/route, news, sectors, watchlist, staking pages and the remaining API routes — pull in as needed per milestone.

## Status

| Milestone | State |
| --- | --- |
| M0 Scaffold + BestUI theme | Done |
| M1 Intelligence layer | **Nearly done** — real data only (no mock), shared rate limiter, `OrcaSignal` + `/api/signals`, Opportunities, signal detail, Ask Orca, source badge. Anthropic provider added; Ask Orca just needs an LLM key |
| M0.5 Accounts | **Code complete** — Solana wallet sign-in, email/password, Neon + Drizzle schema/migration, `consume()` daily limits on Ask. Needs `DATABASE_URL` + `AUTH_SECRET` to run end to end |
| M2 Agents | **Built** — `agents`/`decisions` schema, momentum + narrative-rotation strategies, runner, Decision log UI. Paper PnL not built (execution is quote+simulate by default) |
| M3 Risk Engine + policy | **Done** — pure `evaluate()`, `parseProposal()`, policy validation with hard ceilings, global + per-agent kill switch, 24 passing tests |
| M4 Solana execution | **Built** — wallet detection + fund flow, per-agent encrypted signer, Jupiter quote/swap, simulate-then-send, human approval with Risk Engine re-check. Sending is OFF unless `EXECUTION_ENABLED=1` |
| M5 Autonomous + portfolio + alerts | **Built** — hourly cron sweep (`/api/cron/run-agents`, `CRON_SECRET`), portfolio page, Telegram alerts. Paper trading + PnL added (virtual $1,000 filled at real Jupiter quotes) |
| M6 Hardening | **Partly built** — `assertQuoteSane` price guard (tested, live-checked against Jupiter), 429 retry, priority-fee option, `PILOT_MAX_TRADE_USD` cap. Pyth Hermes now returns 401 without credentials, so the reference price is SoSoValue (independent of the DEX). Jito/MEV bundles not done |
| M7 Billing | **Built** — Stripe subscription checkout, billing portal, signature-verified webhook mapping prices to plans. Untested without Stripe keys. USDC payment not built |
| M8 Growth | **Built** — referral codes, opt-in `/leaderboard` (paper agents), opt-in shareable `/d/[id]` Decision Records. No referral rewards |

## Next steps (in order)
1. Finish M1: port `/ask` (route + page) as Ask Orca; signal detail page with citations and contradictions; show `source` badge.
2. M0.5: auth (wallet SIWE + email), Postgres + Drizzle, free-tier limits and usage counters.
3. M2: `agent`/`policy`/`decision` schema, strategy templates, runtime loop in observe mode, Decision log UI, paper PnL.
4. M3: Risk Engine as pure functions with exhaustive unit tests before any wallet code.

## Known issues / notes
- Signal scoring in `src/lib/signals.ts` is a simple momentum + news-bias blend; a heuristic, to be refined and backtested before agents trade on it.
- The SoSoValue key previously committed in MarketMind's public repo should be rotated; Orca reads it from `.env.local`.
- Contradiction-to-asset matching is by symbol text match; revisit when contradictions get structured asset tags.

## Design notes: M3 / M4
- **Agent signer.** Each agent gets its own Solana keypair, encrypted at rest (AES-256-GCM, `AGENT_KEY_SECRET`). It only holds what the user sends it, so the user's exposure is the funded balance plus the Risk Engine limits. This is a simple stand-in for a smart-account spending-limit program (e.g. Squads); swap it in later for on-chain-enforced caps.
- **Jupiter has no devnet liquidity.** Quotes and simulations run against real mainnet state. With `EXECUTION_ENABLED` unset, nothing is sent; an unfunded agent fails simulation honestly (`AccountNotFound`), it is never faked.
- **Approval re-check.** Approving a pending decision re-runs the Risk Engine against fresh balances and spend before any swap.
- **Free plan.** 1 agent, observe-only. Pro 5, Teams 25.

## Update: scoring, USDC, rewards, Jito, on-chain limits
- **Scoring.** `scripts/backtest.ts` (real daily candles, 5 assets, ~90 days each): 1d momentum had a 38.6% hit rate and -0.26%/trade; 7d/14d trend were the only price rules with a positive average, none significant. `src/lib/scoring.ts` now drives direction from 7d/14d trend plus news (24h change no longer an input), fails closed without trend data, and caps conviction at 85. Cold start is ~2 min on the Demo plan rate limit; klines are cached 6h.
- **USDC payments.** Reference-account payments verified on-chain (`checkUsdcTransfer` is pure and tested). Plan lapses at `planExpiresAt` via `effectivePlan`.
- **Referral rewards.** 30 days Pro to the referrer when a referred user first pays (Stripe or USDC), once per referred user, max 12.
- **Jito.** `JITO_TIP_LAMPORTS` builds the swap with a Jito tip and sends bundle-only; refuses to send if the tx has no tip account.
- **On-chain limits.** Squads spending-limit builders + design in `docs/ONCHAIN_LIMITS.md`; not wired or run on-chain.
