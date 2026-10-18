# Payment provider options

Orca can sell Pro and Teams three ways. This file compares them so the final choice can be made at the end. Nothing here is decided.

## Options

| | Stripe (built) | Dodo Payments (built, never run live) | USDC on Solana (built, never run live) |
| --- | --- | --- | --- |
| Model | Payment processor. You are the seller. | Merchant of record. Dodo is the legal seller. | Direct on-chain payment to your treasury wallet |
| Sales tax / VAT | Yours to handle (Stripe Tax is an add-on) | Dodo collects and remits it | Yours to handle |
| Chargebacks and fraud | Yours | Dodo handles them | None (irreversible) |
| Fees | Verify on stripe.com. Typically a percentage plus a fixed fee per card charge, with extras for Tax and Billing | Listed at 4% + 40¢ for US domestic cards, +1.5% international, +0.5% for subscriptions (vendor-published; verify) | Network fee only |
| Subscriptions | Yes: Checkout, portal, webhooks | Yes: subscriptions, usage, credits, seats | Manual: 30 days per payment, user pays again |
| Node SDK | `stripe` (installed) | `dodopayments` | `@solana/web3.js` (installed) |
| Webhook verification | `webhooks.constructEvent` (used) | `client.webhooks.unwrap` with `webhook-id`, `webhook-signature`, `webhook-timestamp` headers | Not applicable: we poll the chain |
| Crypto / stablecoins | Not through this integration | Not listed among its 40+ payment methods | Native |
| Payouts | Bank, in Stripe-supported countries | Bank, after account verification | Your wallet |

## How to choose
- **You want the least tax and compliance work:** Dodo, as a merchant of record, takes on tax, chargebacks and compliance, at a higher percentage.
- **You want the lowest card fees and the most mature tooling:** Stripe, but you carry tax registration and disputes yourself. Check that Stripe supports your country.
- **Your users are crypto-native:** keep USDC as a second option. It cannot be your only one, because it has no automatic renewals.
- They are not exclusive: the billing code is isolated, so a provider can be added next to the others.

## Dodo: what was built (routes `/api/billing/dodo/{checkout,webhook}`)
1. Create subscription products for Pro and Teams in the Dodo dashboard.
2. `POST /api/billing/dodo/checkout`: create a checkout session with `client.checkoutSessions.create` (a `product_cart` and a `return_url`) and redirect to its `checkout_url`.
3. `POST /api/billing/dodo/webhook`: verify with `client.webhooks.unwrap` on the raw body and the three `webhook-*` headers. Handle `subscription.active`, `subscription.renewed` (grant plan), and `subscription.cancelled`, `subscription.on_hold` (revoke or warn).
4. Map Dodo product ids to plans, store the customer and subscription ids, and reuse `grantReferralReward` on the first paid event.

## Sources
- Dodo Payments docs: https://docs.dodopayments.com
- Dodo pricing and fee comparison (vendor-authored): https://dodopayments.com/blogs/cheapest-merchant-of-record
- Independent review: https://fungies.io/dodo-payments-review-2026.md

Dodo's fee figures and country count (220+ on its site, 190+ in an independent review) come from vendor material. Confirm both on the live pricing page before deciding.
