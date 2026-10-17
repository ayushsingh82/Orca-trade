# Orca — AI Trading Agents with On-Chain Execution

> Orca finds the opportunity, explains *why*, and — within limits you set — acts on it on-chain.

## The two ideas, combined

| | Idea 1 | Idea 2 | Orca |
| --- | --- | --- | --- |
| Core | Discover opportunities, analyze markets, execute via AI agents | Autonomous agents for analysis, portfolio mgmt, execution | One product with three layers: **Intelligence → Agents → Execution** |
| Gap | Intelligence without a hard guardrail on action | Agents that act without evidence you can audit | Every trade traces back to cited evidence, and every agent is boxed in by on-chain limits |

**One-liner:** a market-intelligence engine feeds autonomous trading agents that can actually execute on-chain, under user-defined, enforceable risk limits.

## Product shape

### Layer 1 — Intelligence (Discover + Analyze)
- Opportunity feed: ranked setups from news, sector rotation, narrative momentum, macro, and DEX microstructure.
- Ask Orca: cited Q&A ("why is SOL moving?") with confidence + contradictions.
- Contradiction detection: flags when news, breadth, funding and flow disagree. This is the signal that gates agent action.

### Layer 2 — Agents (Decide)
- Users spin up agents from templates: **Momentum**, **Narrative Rotation**, **Mean-Reversion**, **Portfolio Rebalancer**, **DCA+**.
- Each agent has: strategy, universe (allowed assets), budget, risk policy, and a mode.
- Modes: `observe` (log only) → `propose` (human approves) → `autonomous` (acts within policy).
- Every decision emits a **Decision Record**: thesis, citations, confidence, contradictions, proposed order, risk checks passed/failed.

### Layer 3 — Execution (Act)
- Non-custodial. On **Solana**, the user's wallet grants the agent a **limited-authority signer**: allowed tokens, per-trade cap, daily cap, max slippage, expiry, revocable any time.
- Execution router: quote → simulate → risk check → submit → confirm → record.
- Portfolio view: positions, PnL, and per-agent attribution.

## Differentiators
1. **Evidence-gated execution** — no trade without a cited Decision Record; high-severity contradictions auto-downgrade `autonomous` to `propose`.
2. **Enforced, not promised, limits** — caps live in the on-chain signer authority / wallet policy, not just in app code.
3. **Auditable** — every trade replays: data snapshot → reasoning → order → tx hash.
4. **Read-only fallback** — works as pure research desk with no wallet connected.

## Target users
- Retail traders stitching 5 tabs together.
- Small funds / DAO treasuries wanting policy-bound automation.
- Builders who want to fork an agent template.

## Non-goals (v1)
- Custody of user funds.
- Leverage / perps execution (read perps data only).
- Guaranteed returns or "financial advice" framing.
- Many chains — start with one.

## Principles
- Safety defaults: testnet first, `observe` mode default, kill switch always visible.
- Honest provenance: UI always shows live vs. mock data.
- Never trade on LLM output alone: the LLM proposes, deterministic risk code disposes.
