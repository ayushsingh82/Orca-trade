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
| M0.5 Accounts | **Code complete (sign-in gated, see BETA_GATE.md)** — Solana wallet sign-in, email/password, Neon + Drizzle schema/migration, `consume()` daily limits on Ask. Needs `DATABASE_URL` + `AUTH_SECRET` to run end to end |
| M2 Agents | **Built** — `agents`/`decisions` schema, momentum + narrative-rotation strategies, runner, Decision log UI. Paper PnL not built (execution is quote+simulate by default) |
| M3 Risk Engine + policy | **Done** — pure `evaluate()`, `parseProposal()`, policy validation with hard ceilings, global + per-agent kill switch, 24 passing tests |
| M4 Solana execution | **Built** — wallet detection + fund flow, per-agent encrypted signer, Jupiter quote/swap, simulate-then-send, human approval with Risk Engine re-check. Sending is OFF unless `EXECUTION_ENABLED=1` |
| M5 Autonomous + portfolio + alerts | **Built** — daily cron sweep (hourly needs Vercel Pro) (`/api/cron/run-agents`, `CRON_SECRET`), portfolio page, Telegram alerts. Paper trading + PnL added (virtual $1,000 filled at real Jupiter quotes) |
| M6 Hardening | **Partly built** — `assertQuoteSane` price guard (tested, live-checked against Jupiter), 429 retry, priority-fee option, `PILOT_MAX_TRADE_USD` cap. Pyth Hermes now returns 401 without credentials, so the reference price is SoSoValue (independent of the DEX). Jito/MEV bundles not done |
| M7 Billing | **Built** — Stripe subscription checkout, billing portal, signature-verified webhook mapping prices to plans. Untested without Stripe keys. USDC payment not built |
| M8 Growth | **Built** — referral codes, opt-in `/leaderboard` (paper agents), opt-in shareable `/d/[id]` Decision Records. No referral rewards |
| M9 Beta gate and live widgets | **Done** — sign-in closed (banner + API guard), pricing hidden, live sentiment and bots on the landing page, token search on Markets, RSI Research and Order Flow. See `BETA_GATE.md` |

## Remaining work

Code exists for every milestone above (144 unit tests pass, `tsc` and `eslint` clean). What is left is turning it on, proving the parts that have never run for real, and a few product gaps. **You** = needs your account, key or decision; **Code** = engineering.

### 1. To launch the beta (blockers)
| # | Item | Who | Notes |
| --- | --- | --- | --- |
| 1 | Set Vercel env vars: `SOSO_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `COINGECKO_API_KEY`, `AUTH_SECRET`, `AGENT_KEY_SECRET`, `CRON_SECRET`, Privy keys | You | Without `SOSO_API_KEY`, Intelligence Board, News, Sectors, Index & ETF, sentiment and bots fail on the deployed site. Redeploy after setting. |
| 2 | Create a Neon database, set `DATABASE_URL`, run the Drizzle migrations (latest is `0011`) | You | Accounts, agents, decisions, paper PnL, referrals and the waitlist table all need it. |
| 3 | Add an LLM key (`ANTHROPIC_API_KEY`, or `OPENAI_*`) | You | Ask Orca only. Everything else works without it. |
| 4 | Turn sign-in on: `NEXT_PUBLIC_SIGNUP_ENABLED=1` | You | Closed today, see `BETA_GATE.md`. Do this only after items 1 and 2. |
| 5 | ~~Fix the Free plan card~~ | Code | **Done.** Badge now reads "Opens with the beta" while sign-in is closed. |
| 6 | Put the risk disclaimer back somewhere visible (it was removed from the footer) | Code + You | Keep a "not financial advice" line on the landing page and the Risk page. Your call on wording. |
| 7 | Rotate the SoSoValue key that was committed in MarketMind's public repo | You | Listed under Known issues since M1. |

### 2. Built but never run for real
| # | Item | How to prove it |
| --- | --- | --- |
| 8 | Live swaps (`EXECUTION_ENABLED=1`) | Mainnet pilot with `PILOT_MAX_TRADE_USD=10`, one funded agent, watch the Decision log. |
| 9 | Jito bundle sending | Tx build is verified; sending is not. Send one tipped bundle and confirm it lands. |
| 10 | USDC subscription payments | Logic is tested; pay once from a real wallet to `TREASURY_WALLET` and confirm the plan upgrades and lapses. |
| 11 | Stripe checkout, portal and webhook | Needs keys and the Pro and Teams prices. Use test mode and the Stripe CLI to replay webhooks. Dodo Payments checkout is also built and equally untested. |
| 12 | Scheduler | Needs `CRON_SECRET` on Vercel. The Hobby plan runs it once a day; hourly needs Pro. |
| 13 | Telegram alerts | Needs `TELEGRAM_BOT_TOKEN`; send a test alert. |
| 14 | Referral rewards (30 days Pro per paying referral, max 12) | Needs the database, then one referred signup that pays. |
| 15 | Privy sign-in with embedded wallets | Needs the Privy app configured with Solana and your site origin. |

### 3. Not built yet
| # | Item | Notes |
| --- | --- | --- |
| 16 | Squads on-chain spending limits | Builders and design exist (`docs/ONCHAIN_LIMITS.md`) but are not wired or run. Today the agent signer plus Risk Engine enforce caps off-chain. |
| 17 | Shared cache for SoSoValue data | **Code done, needs your Upstash keys.** `src/lib/shared-cache.ts` is a second cache tier (`UPSTASH_REDIS_REST_URL` / `_TOKEN`); unset = in-memory only. Cold pages used to wait up to a minute behind the 8 calls/min limiter (measured: Intelligence Board 52 s cold). Now a page waits at most 40 s then shows a clear error, and `/api/cron/warm` fills the cache ahead of visitors (daily in `vercel.json`; ping it every ~5 min from an external cron for freshness). |
| 18 | Better signals | The backtest found no proven edge (see Update above). Treat output as a ranking, not a prediction, until a longer backtest shows otherwise. |
| 19 | MEV protection beyond Jito tips | Not started. |
| 20 | Public leaderboard | Switched off for the MVP; re-enable together with `app/leaderboard/page.tsx`. |
| 21 | Contradiction-to-asset matching | Still a symbol text match; needs structured asset tags. |
| 22 | Waitlist | UI removed; `/api/waitlist`, `lib/waitlist.ts` and the table remain. Delete them or bring the form back with the beta. |
| 23 | End-to-end tests | Partly done: `npm run smoke` (`scripts/smoke.ts`) checks the public pages, token search, Order Flow search and that sign-in is refused while the gate is closed. A browser-level Playwright test is still open. |

### 4. Suggested order
1. Items 1, 5, 6: a working, honest public site (no database needed).
2. Items 2, 3, 4, 15: accounts and paper trading, with the beta open.
3. Items 12, 13, 14, 17: scheduler, alerts, referrals and a stable data cache.
4. Items 11, 10: paid plans.
5. Items 8, 9, 16, 19: live trading, last and smallest first.

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
