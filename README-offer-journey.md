# Ayende Autos — Offer→Reserve journey + quote-accept gate

One batch: the accepted-offer dead-end is bridged into the purchase pipeline, the
buyer now gates invoicing by accepting the quote, and a journey tracker makes the
whole deal legible. **One Prisma migration** (a single nullable column).

## 1. Files (extract into `C:\Dev\carbridge`)

```
apps/api/prisma/schema.prisma                         EDIT  Reservation.offerId (nullable @unique) + 1:1 relation
apps/web/lib/invoicing.ts                             EDIT  invoice now REQUIRES an ACCEPTED quote; + acceptQuotationByBuyer()
apps/web/lib/account.ts                               EDIT  offer canReserve/agreed + reservation fromOffer + billing quoteId/canAccept
apps/web/lib/types.ts                                 EDIT  view-type fields for the above
apps/web/lib/email/templates.ts                       EDIT  quote email "what happens next" + new offerAccepted template
apps/web/lib/email/index.ts                           EDIT  + sendOfferAcceptedEmail()
apps/web/components/MyActivity.tsx                     EDIT  JourneyTracker + "Reserve at price" + "Accept quote" buttons
apps/web/components/AdminBilling.tsx                   EDIT  "Awaiting buyer acceptance" gate + Accepted step
apps/web/app/api/admin/offers/[id]/route.ts           EDIT  sends offer-accepted email on admin accept
apps/web/app/api/offers/[id]/respond/route.ts         EDIT  sends offer-accepted email on buyer accept-counter
apps/web/app/api/reservations/from-offer/route.ts     NEW   reserve at the accepted-offer price (race-safe)
apps/web/app/api/quotations/[id]/accept/route.ts      NEW   buyer accepts the quote (the gate)
```

```powershell
Expand-Archive -Force "$HOME\Downloads\ayende-offer-journey.zip" -DestinationPath C:\Dev\carbridge
```

## 2. Migrate Neon, then build (do this BEFORE deploying)

```powershell
cd C:\Dev\carbridge
pnpm -F "@carbridge/api" exec prisma migrate dev --name add_reservation_offer_link
pnpm -F "@carbridge/web" build
```
`migrate dev` writes the migration, applies it to Neon (via DIRECT_URL), and
regenerates the client. **Commit the new `apps/api/prisma/migrations/...` folder**
along with the code — Vercel runs `prisma generate` against the already-migrated
Neon at build time (there is no Vercel migrate step).

No new env vars. (Email still uses RESEND_* from the last batch.)

## 3. The journey

```
Offered → Accepted → Reserved → Quoted → Accepted(quote) → Invoiced → Paid   (offer-origin)
                     Reserved → Quoted → Accepted(quote) → Invoiced → Paid   (direct buy-now)
```

- **Offer accepted** (admin accepts, or buyer accepts a counter) → buyer gets an
  in-app nudge **and** an email with a Reserve CTA. The agreed price = the counter
  if the deal closed on one, else the original offer.
- **Reserve at the agreed price** holds the car ONLY on the buyer's tap, via your
  existing optimistic AVAILABLE→RESERVED lock — if it sold first, clean 409. The
  reservation links back to the offer (`offerId @unique` = one reservation/offer)
  and freezes a fresh 72h lock at the agreed rate + agreed total.
- **Accept quote** (buyer) flips the quote ISSUED→ACCEPTED. From here the existing
  quote→invoice→pay pipeline runs unchanged.

## 4. ⚠️ Behaviour change — the gate applies to ALL quotes

Previously, issuing the invoice auto-accepted the quote (admin quoted then
invoiced back-to-back). Now `issueInvoiceForQuotation` **requires** an ACCEPTED
quote, and only the buyer's "Accept quote" sets that. This adds a buyer step to
the **direct buy-now path too**, not just offers — by design (one rule, all
quotes). In the admin Billing tab the Issue-invoice button is replaced by an
**"Awaiting buyer acceptance"** chip until the buyer accepts.

If you'd rather offer-origin quotes auto-accept (since price was already agreed in
the offer), that's a small tweak — say the word.

## 5. Emails touched

- **Quote email** — adds a numbered "What happens next" and an Accept CTA → /account.
- **Offer-accepted email (new)** — Reserve CTA → /account. Fires on BOTH accept
  paths (admin-accept and buyer-accept-counter). If the buyer-accept one feels
  redundant (they're already in-app), I can drop it to admin-accept only.

## 6. Watch items

- Buyer-accept-counter sends the offer-accepted email too — see §5.
- `from-offer` derives both CAD+NGN from the single agreed amount via the offer's
  locked rate (round-half-up, `D` from `@carbridge/shared`). If an offer somehow
  has no rate lock, it falls back to the current FX snapshot.
