# @carbridge/api

The NestJS API (incoming) and the Prisma data layer for CarBridge.

## Data layer (Prisma)

`prisma/schema.prisma` is the SRD §7 data model. Every money column is `Decimal`,
so values hand straight to `@carbridge/shared`'s cost engine via `.toString()`
(Prisma's Decimal is decimal.js under the hood).

### First-time setup

1. Copy env and set your database URL:
   ```
   cp .env.example .env   # then edit DATABASE_URL
   ```
2. Need a local Postgres? One line with Docker:
   ```
   docker run --name carbridge-pg -e POSTGRES_USER=carbridge -e POSTGRES_PASSWORD=carbridge -e POSTGRES_DB=carbridge -p 5432:5432 -d postgres:16
   ```
3. From the repo root:
   ```
   pnpm install                                    # builds Prisma (allowed in pnpm-workspace.yaml)
   pnpm --filter @carbridge/api prisma:generate    # generate the client
   pnpm --filter @carbridge/api prisma:migrate     # create & apply the first migration
   pnpm --filter @carbridge/api prisma:studio      # browse data (optional)
   ```

## Scripts

- `prisma:generate` — generate the typed client
- `prisma:migrate` — `prisma migrate dev` (create + apply a migration)
- `prisma:deploy` — `prisma migrate deploy` (apply migrations in CI/prod)
- `prisma:studio` — open Prisma Studio
- `db:validate` / `db:format` — validate / format the schema
