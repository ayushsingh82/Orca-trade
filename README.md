# Orca

**AI trading agents with on-chain execution, on Solana.** Orca finds the opportunity, explains *why*, and, within limits you set, acts on it.

## How two ideas became one product

| | Idea 1: AI crypto trading platform | Idea 2: autonomous AI trading agents | Orca |
| --- | --- | --- | --- |
| Strength | Discover opportunities, analyze markets, execute | Agents that analyze, manage a portfolio and trade | Both, in one pipeline |
| Weakness | Insight without a safe way to act | Agents acting without evidence you can audit | Every action is backed by cited evidence and boxed in by hard limits |

The two ideas are two halves of one loop. Idea 1 is the **brain** (market intelligence); Idea 2 is the **hands** (agents that execute). Orca connects them with a strict middle layer:

```
 Intelligence ──► Agents ──► Risk Engine ──► Execution
 (discover +      (decide:    (deterministic,  (Jupiter swap on Solana,
  analyze, cited)  propose)    no LLM)          limited-authority signer)
```

1. **Intelligence (Idea 1).** Live news, sector, macro and market data are scored into ranked `OrcaSignal`s with conviction, citations and cross-source contradictions. Users can also ask questions ("Ask Orca") and get cited answers.
2. **Agents (Idea 2).** Users create agents from templates (momentum, narrative rotation, rebalancer...). An agent reads signals plus its portfolio and policy, and emits a *proposal*. Modes: `observe` (log only), `propose` (human approves), `autonomous` (acts within policy).
3. **Risk Engine.** Plain code, never the LLM. It checks allowed assets, per-trade and daily caps, slippage and contradiction severity. A high-severity contradiction downgrades an autonomous agent to `propose`.
4. **Execution.** Non-custodial. Quote, simulate, sign with a revocable signer whose limits are enforced on-chain, confirm, then record the transaction in the agent's **Decision Record** (data snapshot, reasoning, order, tx hash).

**Principle:** the LLM proposes; deterministic code disposes. **Real data only:** no mock fallbacks anywhere.

## Where the code comes from

The intelligence layer is ported from [MarketMind](https://github.com/ayushsingh82/MarketMind), a read-only research app that never trades. Orca keeps its SoSoValue/SoDEX clients, news-impact and contradiction engine, and grounded-LLM pattern (in `app/src/lib/intel/`), then adds what MarketMind deliberately lacked: accounts, agents, a risk engine, and execution. Details: [`app/plan.md`](app/plan.md).

## Docs

| File | What it covers |
| --- | --- |
| [`IDEA.md`](IDEA.md) | Product concept, layers, differentiators, non-goals |
| [`PLAN.md`](PLAN.md) | Architecture, tech choices, milestones M0 to M8, tiers and billing, safety rules |
| [`app/plan.md`](app/plan.md) | How we execute, MarketMind mapping, live status |

## Status

| Milestone | State |
| --- | --- |
| M0 Scaffold + BestUI dark theme | Done |
| M1 Intelligence (signals, opportunities, signal detail, Ask Orca) | Built; Ask Orca needs an LLM endpoint |
| M0.5 Accounts (Solana wallet + email sign-in, Neon Postgres, daily limits) | Code complete; needs `DATABASE_URL` and `AUTH_SECRET` |
| M2 Agents (strategies, runner, Decision log) | Built; needs database to run |
| M3 Risk Engine (pure, 24 tests passing) | Done |
| M4 Solana execution (Jupiter quote/simulate, approvals, agent signer) | Built; real sending is off until `EXECUTION_ENABLED=1` |
| M5 to M8 Autonomy + portfolio + alerts, hardening, billing, growth | Not started |

## Run it

```bash
cd app
cp .env.example .env.local   # fill in SOSO_API_KEY, DATABASE_URL, AUTH_SECRET, LLM vars
npm install
npx drizzle-kit migrate      # applies drizzle/ to your Neon database
npm run dev
```

Needs: a SoSoValue API key, an `AGENT_KEY_SECRET` (32+ chars), a Neon Postgres connection string, `AUTH_SECRET` (32+ chars), and an OpenAI-compatible LLM endpoint for Ask Orca.

## Stack

Next.js 16, React 19, Tailwind v4 (BestUI dark theme), Drizzle + Neon Postgres, `jose` sessions, Solana wallet sign-in (ed25519 message signature), Jupiter + Pyth planned for execution and risk.

> Not financial advice. Trading is risky. Testnet/devnet first.
