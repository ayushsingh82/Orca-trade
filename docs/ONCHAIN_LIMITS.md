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

## Built (`app/src/lib/exec/squads.ts`, tested structurally)
- `buildVaultSetup`: the two instructions the user signs (create vault, add limit). The agent is not a signer, so
  it cannot change its own limit.
- `buildTopUp`: the agent's instructions to pull USDC from the vault into its wallet within the limit.
- Tests check program ids, signer sets and input validation.

## Not built / not verified
- Nothing has been sent on-chain. The instruction builders are unit-tested, not exercised against a funded vault.
- No UI for the user to sign the setup transaction, no database link between an agent and its vault, and the
  runner does not yet top up from the vault before trading.
- Reading the vault and limit back from chain to confirm the configuration before trusting it.
- Recommendation: validate on devnet or with a tiny mainnet balance before relying on it.
