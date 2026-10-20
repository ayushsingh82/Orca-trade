# Beta gate: sign-in closed, pricing hidden

Orca is showing market and agent data only. Accounts, wallet creation and paid plans are not live yet, so the site advertises "beta access coming soon".

## What changed

### Pricing (landing page)
- `src/components/site/sections.tsx`: while `BILLING_ENABLED` is not `1`, Pro and Teams show **"Coming soon"** instead of $29/mo and $199/mo. Free still shows $0.
- Footnote changed from "Prices are planned and may change at launch" to "Pricing will be announced at launch."
- The "Upcoming · Beta" badge and the waitlist form were already there.

### Sign-in UI
- New `src/components/beta-link.tsx`:
  - `SIGNUP_OPEN` reads `NEXT_PUBLIC_SIGNUP_ENABLED === "1"`.
  - `BetaLink` replaces every `<Link href="/login">`. While closed it renders a greyed, non-clickable element with an amber **"Beta soon"** tag. When open it is a normal link.
- `BetaLink` is used in: navbar (`navbar.tsx`), hero CTA (`hero.tsx`), final CTA and Free-plan button (`sections.tsx`), sidebar `user-menu.tsx`, and the sign-in prompts on the Agents, Wallet, Portfolio, Billing and Markets pages.
- `src/app/login/page.tsx`: amber **"Beta access coming soon"** banner, and the Privy, Solana wallet and email forms sit inside a disabled `<fieldset>`.

### Sign-in API
- `src/lib/billing/flags.ts`: new `signupOpen()` and `signupClosedResponse()` (HTTP 503, "Beta access coming soon").
- Guard added as the first line of `POST` in `src/app/api/auth/{login,signup,nonce,wallet,privy}/route.ts`.
- `logout` and `me` are unguarded, so the UI can still check state and clear a session.
- Side effect: existing users cannot sign in either while closed.

## Flags

| Flag | Default | Effect when `1` |
| --- | --- | --- |
| `NEXT_PUBLIC_SIGNUP_ENABLED` | unset (closed) | Reopens sign-in UI and auth API routes |
| `BILLING_ENABLED` | unset (closed) | Shows Pro and Teams prices, opens checkout |

`NEXT_PUBLIC_*` is inlined at build time: set it in `.env.local` and restart `next dev`, or rebuild for production.

## Verified
- `tsc --noEmit` clean.
- `POST /api/auth/{login,signup,nonce,wallet,privy}` return 503; `GET /api/auth/me` returns 200.
- Landing HTML contains "Beta soon" and "Coming soon"; `/login` contains the banner.

## To go live
1. Set `NEXT_PUBLIC_SIGNUP_ENABLED=1` (and `BILLING_ENABLED=1` when paid plans open, with Stripe keys).
2. Restart or rebuild.

## Hero
- Removed the purple glow (`bg-accent/20 blur-[120px]`) behind the hero headline in `src/components/site/hero.tsx`.

## Waitlist removed, navbar trimmed
- Removed the waitlist form and its copy from the landing page pricing section (`sections.tsx`); Pro and Teams buttons now show a disabled "Coming soon". Same on the billing page. FAQ and login banner no longer mention a waitlist.
- Navbar: removed the **Markets** and **Live** links.
- Kept (unused for now): `/api/waitlist`, `lib/waitlist.ts`, `waitlist-form.tsx`, the `waitlist` DB table.

## UI polish
- FAQ (`sections.tsx`): larger rows, a +/× icon that rotates into a cross when a question is open, hover/open border.
- Live sentiment (`sentiment-view.tsx`): "Market mood" caption, score badge, bars fill from the centre in red or green.
- Bot cards (`bot-card.tsx`): the long "Watching: …" line is now chips (symbol, price, direction + conviction), capped at 4 on the landing page with "+N more".

## CTA and footer
- Closing CTA (`sections.tsx`): purple glow removed, subtle grid backdrop, eyebrow line, larger headline, white primary button.
- Footer (`footer.tsx`): removed the "Not financial advice…" disclaimer and © line (the Risk disclosure link stays in the Legal column). Added a large faded "Orca" wordmark at the bottom.

## Live section
- `live-now.tsx`: sentiment + 3 bots now sit in a 2×2 grid (stacks on mobile). Navbar Login is a bordered button; `BetaLink` disabled state restyled with a pulsing amber 'Beta soon' pill.
