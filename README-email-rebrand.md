# CarBridge → Ayende Autos: email + rebrand batch

One combined batch: transactional **email** (Resend) + **surface rebrand** to
"Ayende Autos" + document prefixes **CB- → AA-**. Internal package names
(`@carbridge/*`), `CB_*` env keys, the repo, and the Vercel project are
deliberately unchanged (invisible to users).

## 1. Files in this zip (extract into `C:\Dev\carbridge`)

```
apps/web/lib/brand.ts            NEW   one brand constant (name, domain, support email)
apps/web/lib/email/index.ts      NEW   send seam (dev stub ↔ Resend) + 4 send fns
apps/web/lib/email/resend.ts     NEW   Resend HTTP provider (no SDK dep)
apps/web/lib/email/templates.ts  NEW   quote / invoice / receipt / premium-granted
apps/web/lib/invoicing.ts        EDIT  post-tx email hooks (quote, invoice, membership, receipt)
apps/web/lib/subscriptions.ts    EDIT  grant email on the admin direct-grant path
apps/web/lib/numbering.ts        EDIT  CB- → AA- prefixes
rebrand-apply.ps1                NEW   swaps the 9 visible "CarBridge" UI strings
README-email-rebrand.md          NEW   this file
```

Extract:
```powershell
Expand-Archive -Force "$HOME\Downloads\carbridge-email-rebrand.zip" -DestinationPath C:\Dev\carbridge
```

## 2. Run the UI rebrand, then build

```powershell
cd C:\Dev\carbridge
.\rebrand-apply.ps1            # swaps wordmark/copy in the 9 component files
pnpm -F "@carbridge/web" build # the real gate
```
`rebrand-apply.ps1` is idempotent and only touches the visible strings from your
grep — `@carbridge/*` imports and the `quote-invoice/types.ts` comments are left
as-is.

## 3. Email env (add to Vercel → Production; nothing needed locally)

| Key | Value | Notes |
|---|---|---|
| `RESEND_API_KEY` | from resend.com | **Absent = dev stub** (logs, sends nothing). Present = live sends. |
| `EMAIL_FROM` | `Ayende Autos <onboarding@resend.dev>` | Use Resend's onboarding domain until `ayendeautos.ca` is verified, then flip to `noreply@ayendeautos.ca`. |
| `EMAIL_REPLY_TO` | e.g. `support@ayendeautos.ca` | Optional. |
| `EMAIL_BCC` | your inbox | Optional — get a copy of every send. |
| `NEXT_PUBLIC_APP_URL` | `https://carbridge-web.vercel.app` | Links in emails. Update at domain cutover. |

Redeploy after setting env (Vercel only picks up env on new deployments).

## 4. What fires when (all best-effort — a mail failure never breaks the flow)

- Issue quote        → quote email (number, landed total, rate-lock expiry)
- Issue invoice      → invoice email (number, amount, **bank details + due date**)
- Issue membership   → invoice email (membership)
- Record payment → PAID → receipt email (CAR) **or** premium-granted email (membership)
- Admin direct grant → premium-granted email

The receipt/grant emails fire **only on the ISSUED/PART_PAID → PAID transition**,
so re-recording the same reference won't re-send.

## 5. Document numbers

New quotes/invoices issue as `AA-Q-2026-NNN` / `AA-INV-2026-NNN`. The per-year
sequence is keyed by (kind, year), so AA- **continues** the existing count rather
than restarting at 001 — already-issued CB- documents keep their stored numbers.
Want AA- to start at 001? Reset the 2026 `DocumentCounter` rows — say the word
and I'll give the snippet.

## 6. Watch items

- **server-only reach:** `subscriptions.ts` now imports the (server-only) email
  module. It's only used server-side today, so this is fine — but if `next build`
  ever flags "server-only imported from a Client Component," that points at a
  client import of `subscriptions.ts` to untangle.
- **Wordmark width:** "Ayende Autos" is wider than "CarBridge" — eyeball the
  header/landing wordmark on mobile after build.

## 7. Domain cutover (later — gated on you registering ayendeautos.ca)

When `ayendeautos.ca` is registered and pointed at Vercel:
1. Add the domain in Vercel → assign to `carbridge-web`.
2. Set `NEXT_PUBLIC_APP_URL=https://ayendeautos.ca` (or `https://www.…`).
3. Verify the domain in Resend (add the SPF/DKIM DNS records it gives you), then
   set `EMAIL_FROM="Ayende Autos <noreply@ayendeautos.ca>"`.
4. Re-register the Clerk webhook at the new origin (`/api/webhooks/clerk`); copy
   the new signing secret to `CLERK_WEBHOOK_SECRET`.
5. Update the GitHub repo secrets `FX_REFRESH_URL` and `SWEEP_URL` to the new origin.
6. Redeploy.
