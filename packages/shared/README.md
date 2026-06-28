# @carbridge/shared — Landed-Cost Engine

The single source of truth for CarBridge pricing. A **pure, dependency-light TypeScript
module** so the identical math runs on the NestJS server (authoritative) and in the Next.js
client (optimistic display). No framework, no I/O, no floats.

## Install (in the monorepo)

```
pnpm --filter @carbridge/shared install
pnpm --filter @carbridge/shared test
pnpm --filter @carbridge/shared build
```

## Usage

```ts
import { computeLandedCost, toDisplay, serializeLandedCost } from '@carbridge/shared';

const breakdown = computeLandedCost({
  purchasePriceCAD: '17900',   // pass money as strings (e.g. Prisma Decimal.toString())
  shippingCostCAD: '1750',     // RoRo or container — the selected method's cost
  clearingCostNGN: '2600000',  // manual agent quotation, fixed in naira
  fxRate: '1150',              // effective NGN per 1 CAD (post-spread)
  // handlingRate defaults to '0.12'
});

toDisplay(breakdown).total;        // { cad: '$24,540.17', ngn: '₦28,221,200' }
serializeLandedCost(breakdown);    // JSON-safe, rounded — what the server stores/returns
```

`computeLandedCost` returns full-precision `Decimal`s. Round **only** at the boundary via
`toDisplay` (UI) or `serializeLandedCost` (storage/transport).

## The formula (SRD §8, base currency = NGN)

```
subtotalNGN = (P + S) * r + C
handlingNGN = subtotalNGN * h      // 12% of the FULL landed subtotal
totalNGN    = subtotalNGN * (1 + h)
totalCAD    = totalNGN / r
```

Each line is shown in both currencies: CAD legs (`P`, `S`) reprice in naira as `r` moves,
and the fixed NGN clearing (`C`) reprices in CAD as `r` moves — so both totals update on
every FX tick. That is exactly what drives the live ledger in the UI.

## Locked decisions

| Decision | Choice |
|---|---|
| Handling-fee base | **Full landed subtotal** (purchase + shipping + clearing) |
| Arithmetic | **decimal.js**, 40-digit precision, cloned config (never mutates global) |
| Rounding | **Half-up**, at the display/storage boundary only |
| Minor units | NGN → whole naira; CAD → cents |
| Money inputs | Strings preferred (exact); numbers accepted but can carry float error |
| Authority | Server result is authoritative; client must reconcile before any offer/purchase (FR-CST-05) |

## API

- `computeLandedCost(input): LandedCostBreakdown` — the core computation.
- `toDisplay(breakdown): LandedCostDisplay` — symbols + grouping for the ledger UI.
- `serializeLandedCost(breakdown): SerializedBreakdown` — rounded JSON strings for storage/transport.
- `selectShippingCost(options, method): Decimal` — pick a method's CAD cost.
- `roundMoney(value, currency)` / `formatMoney(value, currency)` — money primitives.

## Tests

`vitest run` — 18 tests covering the §8 worked example to the kobo/cent, container repricing,
the per-listing handling override, live-FX directionality, float-drift safety, serialization,
and input validation.
