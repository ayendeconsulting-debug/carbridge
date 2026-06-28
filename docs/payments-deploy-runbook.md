# Payments Deploy Runbook — going live with Paystack

Local dev runs entirely on a **stub** (no keys, no network) so the whole upgrade
flow is demoable. Production swaps to real Paystack purely via environment — no
code change. This is the one-time wiring.

> ⚠️ **Vercel Hobby is non-commercial.** Move `apps/web` to **Vercel Pro
> ($20/mo) before taking any real payment.** Don't set a live Paystack key on a
> Hobby deployment.

---

## 0. How provider selection works

`selectPaymentProvider()`:
- **stub** when `PAYMENTS_DEV_STUB=1` **or** when `PAYSTACK_SECRET_KEY` is unset,
- **real Paystack** when a `PAYSTACK_SECRET_KEY` is present and the stub flag is off.

So: local = stub by default; production = real once the key is set (and the flag
absent).

---

## 1. Local demo (stub) — no setup

In `apps/web/.env.local`:
```
PAYMENTS_DEV_STUB=1
# optional overrides:
# PREMIUM_PRICE_NGN=45000
# PREMIUM_PLAN_NAME="CarBridge Premium (annual)"
```
Then: visit `/upgrade` → **Subscribe** → the stub forwards through
`/api/subscriptions/dev-complete` → `/upgrade/callback`, which marks the demo
user PREMIUM and sets the tier cookie. Re-run `pnpm -F @carbridge/api prisma:seed`
to reset the demo user back to REGISTERED for another run.

---

## 2. Production env (Vercel, Production scope)

| Key | Value | Notes |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | `sk_live_...` (or `sk_test_...` to trial) | server-side only; never `NEXT_PUBLIC_` |
| `PREMIUM_PRICE_NGN` | `45000` | OQ-3 — confirm the real price point |
| `PREMIUM_PLAN_NAME` | `CarBridge Premium (annual)` | shown on the checkout |

Do **not** set `PAYMENTS_DEV_STUB` in production.

---

## 3. Paystack dashboard wiring

1. **Webhook URL** (Settings → API Keys & Webhooks):
   ```
   https://<your-app>/api/webhooks/payments
   ```
   Paystack signs each call with `x-paystack-signature` = HMAC-SHA512 of the raw
   body using your secret key. The route verifies this and ignores anything that
   doesn't match.
2. **Callback URL** is set per-transaction by the app
   (`https://<your-app>/upgrade/callback`) — nothing to configure in the
   dashboard, but make sure your domain is allowed if you restrict callbacks.

---

## 4. Verify end-to-end (test mode first)

1. Set `PAYSTACK_SECRET_KEY=sk_test_...`, deploy.
2. From `/upgrade`, subscribe and pay with a Paystack **test card**.
3. Confirm two things fire:
   - the **webhook** fulfils the subscription (check the `Subscription` row is
     `ACTIVE` and the user is `PREMIUM`), and
   - `/upgrade/callback` shows **Premium activated** (it also self-verifies by
     reference, so it works even if the webhook is delayed).
4. Switch to `sk_live_...` when satisfied.

---

## 5. Notes & follow-ups

- **Idempotency:** fulfilment is keyed on the Paystack `reference`, so a retried
  webhook plus the callback verify can't double-apply. (`providerRef` isn't a DB
  unique yet — add a unique index when you harden this.)
- **Auto-downgrade** (FR-SUB-03): expired subscriptions are handled by the
  existing sweep route (`/api/admin/sweep`) — wire its schedule when you enable
  the reservation/FX crons.
- **Auth:** the checkout currently resolves the demo REGISTERED user. When Clerk
  lands, resolve the signed-in user instead, and drop the tier-cookie bridge in
  `PremiumActivated` / the View-as toggle.
- **Receipts/history page** and the **Buy-Now deposit** were deferred this round.
