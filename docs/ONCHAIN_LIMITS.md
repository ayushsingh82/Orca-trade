# On-chain spending limits (Squads)

## Problem
Each live agent has a signer key that the Orca server holds (encrypted). Today the user's exposure is bounded by
what they fund the agent with, plus the Risk Engine. Both are off-chain promises: a bug or a compromised server
could move more than the user intended.

## What Squads can and cannot do
Squads v4 *spending limits* let a vault owner allow one member to transfer at most N of a token per period to a
fixed list of destinations. They cover **transfers only**. A swap is an arbitrary program call, which in Squads
needs a vault transaction that the multisig threshold approves, and an agent that can execute those is not capped.
So Squads cannot cap individual trades.

## Design: cap the funding, not the trade
1. The user creates a 1-of-1 Squads vault they alone control and keeps their funds there.
2. They add one spending limit: member = the agent's wallet, token = USDC, amount = daily cap, period = day,
   destination = the agent's wallet only.
3. Before a live trade, the agent pulls only what it needs from the vault (within the daily limit) into its wallet.
4. The agent trades from its own wallet as today; the Risk Engine still gates each trade.

Result: the most a misbehaving agent or server can ever receive is the daily cap, enforced by the Squads program.
The user can lower or remove the limit, or empty the vault, at any time because they are the config authority.

## Built and verified

- `squads.ts`: `buildVaultSetup` (the transaction the user signs), `buildTopUp` (the agent's pull), `readLimitConfig`
  and `verifyLimitConfig` (read the vault back from chain and prove the cap is real), `effectiveRemaining`.
- `vault.ts`: `pullFromVault` re-reads and re-verifies the vault on every call, then pulls only the shortfall for a
  trade. It fails closed if the limit or the vault balance cannot cover the trade, so a trade is never half-funded.
- Database: `agents.squads_owner / squads_multisig / squads_limit / squads_daily_usdc` (migration `0007`).
- API: `POST /api/agents/[id]/vault/setup` builds the unsigned transaction, `POST .../vault/confirm` links the vault
  only after verifying it on chain, `DELETE .../vault/confirm` unlinks it.
- UI: the Agents page has a "Create vault" flow for live agents, then shows the vault address and the active cap.
- Runner: before a live buy, the agent is funded from the vault (`carryOut` in `agents/runner.ts`).

### What was run against the real Squads program

`app/scripts/squads-e2e.ts` runs the full flow on a local validator with the Squads v4 program cloned from devnet.
It passed all checks:

- a 1-of-1 vault and a 50/day limit are created on chain, and `verifyLimitConfig` accepts them;
- it rejects a wrong owner, a lower promised cap and a different agent;
- the agent pulls 30, then only the 20 shortfall, reaching the 50 cap;
- Orca's planner refuses the next pull, and **the Squads program itself rejects an over-limit pull sent around Orca**;
- a different wallet cannot draw on the agent's limit;
- Orca refuses to fund when the on-chain limit is higher than the cap it recorded.

Running it caught a real bug: the first version required a signature the program does not need, so the setup
transaction could never have been sent.

Run it yourself:

```bash
solana-test-validator --reset --url devnet \
  --clone-upgradeable-program SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf \
  --clone BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr
cd app && npx tsx scripts/squads-e2e.ts
```

## Not verified

- A local validator is not mainnet. The e2e uses a throwaway token in place of USDC; the code paths are the same,
  but nothing has run with real USDC or through a browser wallet (Phantom signing the setup transaction).
- The Agents-page UI and the two API routes have been type-checked and built, not clicked through. They need a
  database and a wallet.
- Squads charges a creation fee on mainnet (paid by the user's wallet in the setup transaction).
- The risk engine's portfolio value for a vault-linked agent counts only the agent wallet, not the vault, so
  concentration limits are measured against a smaller number (more conservative, never less).
- Set `SOLANA_RPC_URL` (server) and `NEXT_PUBLIC_SOLANA_RPC` (browser) to a dedicated RPC for production; the
  public endpoint is rate limited.
- Recommendation: try it with a small amount first.
