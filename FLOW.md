# Orca: the user flow

How a person goes from sign-up to an agent trading with their money, inside limits they set. Each step says what exists today.

Status key: **Built and run** (exercised for real), **Built, untested** (written and type-checked, never run against the real service), **Missing**.

```
Sign up ─► Wallet created ─► Fund wallet ─► Create agent ─► Fund agent (the cap) ─► Agent runs ─► Review / approve ─► Withdraw
```

## 1. Sign up
- The user signs in with **email or Google through Privy**. Without Privy configured, email and password or a Solana wallet still work.
- Orca verifies the Privy token on the server and starts its own session. A referral code on the link is credited to the referrer.
- If the email already has an Orca account, it is linked, not duplicated.
- Status: sign-in screens **built, untested** (needs a Privy app id). Account linking and sessions **built and run** (real database).

## 2. A wallet is created for them
- Privy creates the user's own Solana wallet at sign-up. Orca stores its address.
- Status: **built, untested** (needs Privy). The Wallet page, address and balances **built and run**.

## 3. Fund the wallet
- Open **Wallet**. Copy the deposit address and send **Solana USDC** and a little **SOL** for fees, or press **Add funds** to pay by card or crypto.
- The page reads real on-chain balances.
- Status: balances **built and run**. Add funds **built, untested** (Privy).

## 4. Explore before risking money
- **Intelligence Board**, **News Impact**, **Sectors**, **Order Flow**, **Index & ETF** and **RSI Research** need no login and show live data.
- **Ask Orca** answers questions with cited evidence (needs an LLM key).
- Status: **built and run**, except Ask Orca (needs a key).

## 5. Create an agent
- Pick **Add and run** on a starter agent (Momentum Scout, News Rotator, RSI Dip Watcher), or build one: strategy, mode and limits.
- Starter agents are paper agents in observe mode. They read live data and report what they would do, even when they take no action.
- **Free** plan: up to 3 agents, paper and observe only. **Pro**: live agents with propose and autonomous modes.
- Status: **built and run**.

## 6. Prove it with paper trading
- A paper agent trades a virtual $1,000 at real Jupiter quotes.
- The **Portfolio** page shows: total value across your wallet and agents, paper PnL, realized and unrealized PnL, win rate, an allocation bar, your wallet balances, pending approvals, and per agent an equity curve, positions with average entry, recent activity, and a CSV download of your history.
- Live agents show their real on-chain wallet balances with a Solscan link. Profit and loss for live agents is not tracked yet.
- Status: **built and run**.

## 7. Go live and set the cap
A live agent has its own separate Solana wallet. **The amount sent to it is the cap**: it can only trade what it holds.

| Control | What it does | Status |
| --- | --- | --- |
| Per-trade and daily USD limits | Checked by the Risk Engine before every trade | **Built and run** |
| Slippage, minimum conviction, concentration | Same checks | **Built and run** |
| Mode | observe (log), propose (you approve), autonomous (acts within limits) | **Built and run** |
| Kill switch | Per agent, and platform-wide with `ORCA_GLOBAL_KILL=1` | **Built and run** |
| Price guard | A quote far from an independent reference price is refused | **Built and run** |
| Fund from your wallet | **Send to agent** moves USDC or SOL from your Orca wallet to the agent | **Built, untested** (Privy signing) |
| On-chain daily cap (optional) | A Squads vault you control; the agent can pull at most the daily limit from it | **Built and run on a local chain.** Still asks for an external wallet (Phantom), not the Privy wallet |

Live sending stays **off** unless the platform sets `EXECUTION_ENABLED=1`. Until then, live agents quote and simulate only.

## 8. The agent runs
Every run, on a schedule (daily on Vercel Hobby, hourly on Pro or an external scheduler) or on **Run now**:

1. Read live signals, plus RSI for the RSI strategy.
2. The strategy proposes a trade, or nothing.
3. The **Risk Engine** checks it against the limits: reject, log only, ask for approval, or allow.
4. If allowed, Orca gets a Jupiter quote, checks it against the reference price, simulates it, and sends it only if live sending is on.
5. A **Decision Record** is saved either way, and a Telegram alert is sent if configured.

Status: **built and run** for paper agents. Real mainnet swaps **not run** (needs a funded wallet).

## 9. Review and approve
- In **propose** mode a trade waits for the user. **Approve** re-runs the Risk Engine on fresh balances before anything happens.
- High-severity contradictions between sources downgrade an autonomous agent to asking first.
- Any decision can be shared by link.
- Status: **built and run**.

## 10. Take money out
- A **Withdraw** button on each live agent (Agents and Portfolio pages) sends USDC, SOL, or **everything** back to the user's own wallet. The server signs from the agent's wallet.
- The destination is always the signed-in user's own wallet, read from their account and never from the request. A stolen session cannot redirect funds, another user cannot touch the agent, and paper agents hold nothing to withdraw.
- Over-withdrawals are refused with a clear message, the owner pays nothing (the agent covers fees and the owner's token-account rent), and every withdrawal is recorded with its transaction link.
- Status: **built and run** on a local chain with real USDC and wBTC mints (14 checks) and through the app against a real database (22 checks). Not run on mainnet.

## 11. Pay for Orca
- Free, Pro (about $29/month) and Teams (about $199/month). Pay by card with **Stripe** or **Dodo Payments**, or in **USDC** for 30 days.
- A paying referral gives the referrer 30 days of Pro.
- Status: webhooks and USDC verification **built and run** on test events and a local chain. Real checkouts **not run** (needs your keys).

## Gaps, in priority order
1. **Squads cap with a Privy wallet** (the vault setup only accepts an external wallet).
2. **One "Invest" step** that picks the agent, the amount and the cap on one screen, instead of separate screens.
3. **Profit and loss for live agents** (needs deposits recorded as well as withdrawals).
4. First real run of Privy, a real checkout and a funded mainnet trade, each with a small amount.
