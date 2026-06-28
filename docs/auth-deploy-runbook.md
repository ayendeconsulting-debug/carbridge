# Auth Deploy Runbook — activating Clerk

Locally the app runs on the **dev-bypass** (the View-as toggle + `cb_admin`
cookie), so nothing is required to keep developing. Dropping in Clerk keys flips
the whole app to real authentication — no code change. Clerk dev keys are free
and instant.

> One seam governs everything: `lib/auth.ts` → `getAuthContext()`. When both
> Clerk keys are present it uses the Clerk session + DB; otherwise the bypass.

---

## 0. What "enabled" means

- `clerkEnabled()` (server) and `CLERK_ENABLED` (client) are both true only when
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` **and** `CLERK_SECRET_KEY` are set.
- When false: middleware is a pass-through, `<ClerkProvider>` is not mounted,
  the header shows the View-as toggle, and gates read the cookies + demo user.
- When true: `clerkMiddleware` runs, `<ClerkProvider>` mounts, the header shows
  Sign in / `<UserButton>`, and gates read the Clerk session → DB.

---

## 1. Create a Clerk app + keys

1. Create an application at dashboard.clerk.com (a **Development** instance is fine).
2. Copy the two keys into `apps/web/.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   ```
3. Restart `pnpm -F @carbridge/web dev`. The header now shows **Sign in**; the
   View-as toggle is gone. Sign up → you land back signed-in, and the catalog
   stays public.

For production, set the same keys (use `pk_live_…`/`sk_live_…`) in Vercel's
Production env.

---

## 2. User sync webhook (FR-MEM-01)

The app upserts a DB `User` on sign-up via `/api/webhooks/clerk` (svix-verified).

1. Clerk Dashboard → **Webhooks → Add endpoint**:
   ```
   https://<your-app>/api/webhooks/clerk
   ```
2. Subscribe to `user.created` and `user.updated`.
3. Copy the endpoint's **Signing Secret** into env as `CLERK_WEBHOOK_SECRET`.

Until the webhook fires, `getAuthContext()` self-heals by upserting the user on
first authenticated request, so sign-in works even before the webhook lands.

> Locally, point the webhook at a tunnel (e.g. `ngrok http 3000`) if you want to
> exercise it; otherwise the on-the-fly upsert covers dev.

---

## 3. Admin role (publicMetadata)

Admin is `publicMetadata.role === "admin"`.

1. Clerk Dashboard → **Users** → pick your user → **Metadata → Public** → set:
   ```json
   { "role": "admin" }
   ```
2. That user can now reach `/admin` and the admin action routes.

**Recommended (avoids an API call per request):** add `publicMetadata` to the
session token so the role is read from claims instead of `currentUser()`.
Dashboard → **Sessions → Customize session token**:
```json
{ "metadata": "{{user.public_metadata}}" }
```
With this set, `getAuthContext()` reads the role from `sessionClaims.metadata.role`
and never calls the Clerk API on the hot path.

---

## 4. Env summary

| Key | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | client + server | enables Clerk |
| `CLERK_SECRET_KEY` | server | enables Clerk |
| `CLERK_WEBHOOK_SECRET` | server | svix signing secret for user sync |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | client | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | client | `/sign-up` |

---

## 5. What the swap retires

- The `cb_tier` / `cb_admin` cookies and the View-as toggle become **dev-only**
  (only consulted when Clerk is disabled).
- The payments tier-cookie bridge (`PremiumActivated`) is harmless under Clerk —
  the DB tier drives the UI — but you can drop it once Clerk is permanent.
- The "re-seed to retest upgrade" quirk disappears: each Clerk user is distinct,
  and checkout upgrades the actual signed-in user.

---

## 6. Notes

- **Middleware filename:** Next ≤15 uses `middleware.ts` (this repo). Next 16+
  renames it to `proxy.ts` — same code, just the filename.
- **Keep webhooks public:** the matcher leaves `/api/webhooks(*)` unprotected;
  they authenticate via signatures, not sessions.
- **Production:** the auth middleware adds a request hop — fine on Vercel. Pair
  with the Vercel Pro move already required before live payments.
