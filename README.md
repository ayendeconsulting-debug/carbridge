# CarBridge

Canadian cars, landed in Lagos — a mobile-first marketplace with a fully transparent
landed-cost ledger. pnpm monorepo.

## Layout

```
carbridge/
├─ apps/
│  ├─ api/    # NestJS API (cost engine source of truth, FX feed, offers) — to come
│  └─ web/    # Next.js buyer PWA + admin console — to come
└─ packages/
   └─ shared/ # @carbridge/shared — pure landed-cost engine + types (server + client)
```

## Getting started

```bash
pnpm install          # builds esbuild (allowed in pnpm-workspace.yaml)
pnpm -r test          # runs every package's tests — expect @carbridge/shared green
pnpm -r build
```

Requires Node >= 22 and pnpm 11.

## Notes

- pnpm 11 blocks dependency build scripts by default. Allowed builds live under
  `allowBuilds:` in `pnpm-workspace.yaml` (not `.npmrc` or `package.json`).
- All pricing math runs through `@carbridge/shared` so the server (authoritative)
  and the client compute identical landed costs. Money is decimal.js, never floats.
