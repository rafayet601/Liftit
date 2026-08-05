# Liftit Pro — billing operations

Everything billing-related ships **dormant**. The beta build behaves exactly
as if none of this exists until two things happen: secrets are configured and
`BILLING_ENFORCED` flips to `"true"`. This document is the operator's guide
to turning it on.

## How it fits together

- `entitlements` (D1, see `schema.sql`) — one row per paying or grandfathered
  user; **no row = free plan**. `expires_at NULL` = never lapses.
- `BILLING_ENFORCED` (`wrangler.toml` / Pages dashboard) — the launch switch.
  While `"false"`, every signed-in account resolves to Pro.
- Sync **writes** are the gated feature (HTTP 402). Reads and deletes are
  never gated: users can always pull their history down or erase it.
- Webhook safety rules (`resolveEntitlementUpdate` in `functions/api/_lib.js`,
  pinned by `src/test/billing.test.js`):
  - Nothing ever strips a lifetime grant (grandfathers, lifetime purchases).
  - A billing system can only downgrade plans it granted itself — an App
    Store expiry can't kill a Stripe subscription, and vice versa.

## Web checkout (Stripe)

1. In the Stripe dashboard create one product ("Liftit Pro") with up to three
   prices: monthly (recurring), yearly (recurring), lifetime (one-time).
2. Set the secrets (Pages dashboard → Settings → Environment variables, or CLI):

   ```bash
   npx wrangler pages secret put STRIPE_SECRET_KEY
   npx wrangler pages secret put STRIPE_WEBHOOK_SECRET
   ```

3. Set the price ids you sell as plain vars (`wrangler.toml` `[vars]` or the
   dashboard): `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`,
   `STRIPE_PRICE_LIFETIME`. The client only renders buy buttons for
   configured prices — unset ones simply don't exist.
4. Add a webhook endpoint in Stripe pointing at
   `https://<your-domain>/api/billing/webhook`, subscribed to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Its signing secret is `STRIPE_WEBHOOK_SECRET`.
5. Enable the **customer portal** in Stripe (Settings → Billing → Customer
   portal) so "Manage subscription" works.

Flow: Settings → Go Pro → `/api/billing/checkout` → Stripe-hosted page →
redirect back to `/settings?billing=success` → webhook writes the
entitlement → client re-pulls the session. Renewals, cancellations, and
payment failures all arrive through the same webhook. A 3-day grace window
covers webhook lag and card dunning.

## Native builds (RevenueCat — iOS/Android)

App Store rules require in-app purchase inside the iOS app, so native builds
never show Stripe buttons (web checkout is still fine for the same account).
The server side is ready; the client side needs the RevenueCat SDK when App
Store submission gets close:

1. Create a RevenueCat project with a `pro` entitlement mapped to the App
   Store / Play products.
2. Add `@revenuecat/purchases-capacitor` to the app and, after Liftit sign-in,
   call `Purchases.logIn(<liftit user id>)` — this makes webhook
   `app_user_id` line up with the `users.id` the entitlement is keyed on.
3. Configure RevenueCat's webhook to
   `https://<your-domain>/api/billing/revenuecat` with an Authorization
   header, and store that exact header value as the
   `REVENUECAT_WEBHOOK_AUTH` secret.

Handled events: `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`,
`NON_RENEWING_PURCHASE` (lifetime), `PRODUCT_CHANGE` activate;
`EXPIRATION` deactivates. `CANCELLATION` is deliberately ignored — it only
means auto-renew was switched off, and access runs until expiry.

## Launch checklist (in this order)

1. `npm run cf:db:migrate` — creates the `entitlements` table.
2. `npm run cf:db:grandfather` — **once**: every existing account (the beta
   cohort) gets Pro for life. Run this before the switch flips, never after.
3. Configure Stripe secrets, prices, and webhook (above). Verify with a test
   purchase while `BILLING_ENFORCED` is still `"false"` — entitlement rows
   write either way; nothing is gated yet.
4. Flip `BILLING_ENFORCED` to `"true"` and deploy.
5. Smoke-test: a grandfathered account syncs and shows "Founding · Pro"; a
   fresh account sees the upgrade card and gets 402 on sync writes only.

## Support operations (SQL, via `wrangler d1 execute`)

- Comp a user for life:
  `INSERT INTO entitlements (user_id, plan, source, expires_at, created_at, updated_at) VALUES ('<id>', 'pro', 'comp', NULL, <now_ms>, <now_ms>) ON CONFLICT (user_id) DO UPDATE SET plan='pro', source='comp', expires_at=NULL, updated_at=<now_ms>;`
- Revoke (refund abuse etc.): set `plan='free', expires_at=NULL` for the row.
- Refunds of lifetime purchases are manual by design — webhooks never
  downgrade a lifetime grant.
