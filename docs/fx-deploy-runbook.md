# FX Deploy Runbook — switching live repricing on in production

The CAD→NGN rate only *moves* when something POSTs `/api/fx/refresh`. Locally
that's the dev ticker (`pnpm fx:tick`). In production it's a **GitHub Actions
cron** (`.github/workflows/fx-refresh.yml`) that can't reach `localhost` — so the
app must be deployed first. This runbook is the one-time wiring to make prod
reprice on its own.

> Order matters: deploy → set app env → set repo secrets → trigger once to verify.

---

## 0. Pre-flight

- `apps/web` builds locally: `pnpm -F @carbridge/web build`.
- You have your Neon **pooled** `DATABASE_URL`, Upstash **REST** URL + token, and
  a long random `FX_REFRESH_SECRET` (e.g. `openssl rand -hex 32`).
- **Never** set `FX_DEV_JITTER` in production. It is local-demo only; if set to
  `1` the deployed app would serve a fake random-walk rate.

---

## 1. Deploy `apps/web` to Vercel

1. Import the repo into Vercel. Set **Root Directory** to `apps/web`.
2. Framework preset: **Next.js**. Build command and output are auto-detected.
3. Add environment variables (Production scope):

   | Key | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | Neon **pooled** URL (host has `-pooler`) | runtime queries |
   | `FX_SPREAD_BPS` | `150` | your FX margin (placeholder; see OQ-2) |
   | `FX_REFRESH_SECRET` | the long random hex | **must match** the repo secret below |
   | `UPSTASH_REDIS_REST_URL` | `https://xxxx.upstash.io` | REST tab, not the `redis://` string |
   | `UPSTASH_REDIS_REST_TOKEN` | `Ax...` | REST tab |

   Do **not** add `FX_DEV_JITTER` or `FX_DEV_JITTER_CENTER`.

4. Deploy. Note the production URL, e.g. `https://carbridge.vercel.app`.
5. Smoke-test the read path in a browser or terminal:
   ```
   GET https://<your-app>/api/fx/current
   ```
   It should return a snapshot (cache → DB → fallback), even before the cron runs.

> ⚠️ **Vercel Hobby is non-commercial only.** Move to **Vercel Pro ($20/mo)
> before taking any payment.** Hobby cron is also daily-only — which is exactly
> why FX refresh runs on GitHub Actions instead.

---

## 2. Set the two GitHub repo secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `FX_REFRESH_URL` | `https://<your-app>/api/fx/refresh` |
| `FX_REFRESH_SECRET` | the **same** value as the app's `FX_REFRESH_SECRET` |

If the two `FX_REFRESH_SECRET`s don't match, every cron call returns `401` and the
rate silently stops updating.

---

## 3. Verify the cron without waiting 10 minutes

The workflow (`.github/workflows/fx-refresh.yml`) already has `workflow_dispatch`,
so you can trigger it by hand:

1. Repo → **Actions → fx-refresh → Run workflow**.
2. Open the run log — the step prints `refresh responded: 200`.
3. Re-fetch `GET /api/fx/current`; `fetchedAt` should be seconds old and `source`
   should be `open-er-api` (not `fallback`).

After that it runs automatically every ~10 minutes (`*/10 * * * *`).

---

## 4. Caveats to remember

- **60-day inactivity:** GitHub disables scheduled workflows after 60 days with no
  repo activity. A commit (or a manual run) re-arms it.
- **Spread is a placeholder.** `FX_SPREAD_BPS=150` protects margin against intraday
  swing but does not resolve **OQ-2** (official vs parallel/market rate). When that
  decision lands, it's a one-file swap behind the `FxProvider` interface — no
  callers change.
- **Staleness is already handled.** If the provider fails, `getCurrentSnapshot()`
  keeps serving the last-known-good row and the UI flags it; the price never hard-
  errors on an FX outage.
- **Rate of change:** open.er-api is a near-static daily reference rate, so the
  production total will move modestly (on real rate changes), not second-by-second.
  The dramatic local movement you see is the dev jitter — production is honest.

---

## 5. Rollback / pause

- Pause auto-refresh: disable the **fx-refresh** workflow in the Actions tab. The
  app keeps serving the last stored rate.
- Force a known rate temporarily: insert/seed an `FxRate` row; `getCurrentSnapshot`
  will serve it until the next successful refresh overwrites the cache.
