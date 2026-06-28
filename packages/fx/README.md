# @carbridge/fx

The CAD→NGN FX feed for CarBridge: provider adapter, spread/margin, staleness,
and the 72-hour rate-lock. Pure and framework-agnostic — the same core runs in a
Next.js route handler (Path A) or a NestJS service (Path B). Rates are carried as
decimal **strings**, so they hand off cleanly to `@carbridge/shared`'s cost
engine and to Prisma `Decimal` columns (no floats, ever).

## Core API

```ts
import {
  createOpenErApiProvider, createFixedProvider,
  refreshFxRate, applySpread, isStale, ageSeconds,
  createRateLock, isRateLockValid, rateLockRemainingMs,
} from "@carbridge/fx";

// 1. Pick a provider (swappable — see OQ-2 below)
const provider = createOpenErApiProvider();            // live, key-less
// const provider = createFixedProvider({ rate: "1150" }); // dev / fallback

// 2. Refresh: fetch raw rate, apply margin, flag staleness
const snap = await refreshFxRate(provider, "CAD_NGN", { spreadBps: 150 });
// => { pair, rawRate:"1149.5", effectiveRate:"1166.74...", source, fetchedAt, isStale }

// 3. Lock a rate for a quote/offer/reservation (72h default)
const lock = createRateLock({ pair: "CAD_NGN", rate: snap.effectiveRate, context: "OFFER" });
```

`spreadBps` is basis points: `150` = +1.50%. Configure via `FX_SPREAD_BPS`.

## ⚠️ OQ-2 — official vs. market rate (open decision)

`open.er-api.com` returns an **official-market reference** rate. Nigerian buyers
often transact at the **parallel/market** rate, which can differ materially. This
is the single biggest pricing-integrity decision in the product and it's
**deliberately deferred**: every rate flows through the `FxProvider` interface,
so switching sources (or blending official + market) is a one-file change with
no impact on callers. Decide before launch; the plumbing won't need to.

---

## Path A wiring (Next.js + Neon + Upstash, all free tier)

The core above is storage-agnostic. Here's the thin glue for Path A. These files
live in the Next.js app (`apps/web`) once it's scaffolded.

### Env

```
FX_SPREAD_BPS=150
FX_REFRESH_SECRET=<long-random-string>      # guards the refresh endpoint
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
DATABASE_URL=postgresql://...               # Neon (pooled connection string)
```

### Refresh endpoint — called by an external cron every ~10 min

`apps/web/app/api/fx/refresh/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { PrismaClient } from "@prisma/client";
import { createOpenErApiProvider, refreshFxRate } from "@carbridge/fx";

const prisma = new PrismaClient();
const redis = Redis.fromEnv();

export async function POST(req: NextRequest) {
  // Vercel Hobby cron is daily-only, so an EXTERNAL scheduler calls this.
  if (req.headers.get("authorization") !== `Bearer ${process.env.FX_REFRESH_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const snap = await refreshFxRate(
    createOpenErApiProvider(),
    "CAD_NGN",
    { spreadBps: process.env.FX_SPREAD_BPS ?? 0 },
  );
  await prisma.fxRate.create({
    data: {
      pair: "CAD_NGN",
      rawRate: snap.rawRate,
      effectiveRate: snap.effectiveRate,
      source: snap.source,
      isStale: snap.isStale,
      fetchedAt: snap.fetchedAt,
    },
  });
  // cache for the live feed (15-min TTL acts as a safety net if cron stalls)
  await redis.set("fx:CAD_NGN:current", JSON.stringify(snap), { ex: 900 });
  return NextResponse.json(snap);
}
```

### Current endpoint — polled by the client every 30–60s

`apps/web/app/api/fx/current/route.ts`

```ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { PrismaClient } from "@prisma/client";
import { isStale, ageSeconds } from "@carbridge/fx";

const prisma = new PrismaClient();
const redis = Redis.fromEnv();

export async function GET() {
  let snap = await redis.get<any>("fx:CAD_NGN:current");
  if (!snap) {
    // cache miss → fall back to the latest persisted row
    const row = await prisma.fxRate.findFirst({
      where: { pair: "CAD_NGN" },
      orderBy: { fetchedAt: "desc" },
    });
    if (!row) return NextResponse.json({ error: "no rate yet" }, { status: 503 });
    snap = {
      pair: row.pair,
      rawRate: row.rawRate.toString(),
      effectiveRate: row.effectiveRate.toString(),
      source: row.source,
      fetchedAt: row.fetchedAt,
    };
  }
  const fetchedAt = new Date(snap.fetchedAt);
  return NextResponse.json({
    ...snap,
    isStale: isStale(fetchedAt),
    ageSeconds: ageSeconds(fetchedAt),
  });
}
```

### External cron (replaces Vercel Hobby's daily-only cron)

Point any scheduler at the refresh route every 10 minutes. GitHub Actions
(free) example — `.github/workflows/fx-refresh.yml`:

```yaml
name: fx-refresh
on:
  schedule: [{ cron: "*/10 * * * *" }]
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "$URL" -H "Authorization: Bearer $SECRET"
        env:
          URL: ${{ secrets.FX_REFRESH_URL }}     # https://<app>/api/fx/refresh
          SECRET: ${{ secrets.FX_REFRESH_SECRET }}
```

(cron-job.org or Upstash QStash work identically — just an HTTP POST with the
bearer header on a schedule.)

### Client hook — live re-price without WebSockets

```ts
import { useEffect, useState } from "react";

export function useFxRate(pollMs = 30_000) {
  const [rate, setRate] = useState<{ effectiveRate: string; isStale: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch("/api/fx/current").then(r => r.json()).then(d => alive && setRate(d)).catch(() => {});
    tick();
    const id = setInterval(tick, pollMs);
    return () => { alive = false; clearInterval(id); };
  }, [pollMs]);
  return rate; // feed effectiveRate into the cost engine's NGN conversion
}
```

At a 30-second cadence the odometer re-roll is indistinguishable from a live
push to a buyer — and it costs nothing on the free tier. Swap in WebSockets
later (Path B) if you want true push.

## Scripts

- `pnpm -F @carbridge/fx test` — run the suite (15 tests)
- `pnpm -F @carbridge/fx typecheck` — types only
- `pnpm -F @carbridge/fx build` — emit `dist/`

> The fx test/typecheck import `@carbridge/shared`, so build shared first:
> `pnpm -r build` (or `pnpm -F @carbridge/shared build`).
