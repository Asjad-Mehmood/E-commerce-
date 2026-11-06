# Hoodie Store

A full-stack e-commerce store for hoodies: a customer **storefront**, an **admin dashboard**, and a **REST API**, in one TypeScript monorepo.

See **[PLAN.md](./PLAN.md)** for the full project plan and roadmap.

> **Status: Phase 0 (foundation) complete.** The monorepo, database schema, seed data, shared packages, API skeleton, app shells, tooling and CI are in place. Next up is Phase 1 (auth, catalog and cart APIs).

---

## Tech stack

| Part                           | Tech                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Storefront (`apps/storefront`) | Next.js 15 (App Router), React 19, Tailwind CSS 4                                         |
| Admin (`apps/admin`)           | Next.js 15, React 19, Tailwind CSS 4                                                      |
| API (`apps/api`)               | Node 22, Express 5, Prisma 6, PostgreSQL 16, Zod 4, Pino                                  |
| Shared                         | `@hoodie/types`, `@hoodie/validation`, `@hoodie/ui`, `@hoodie/config`                     |
| Tooling                        | pnpm workspaces, Turborepo, ESLint 9, Prettier, Vitest, Husky, commitlint, GitHub Actions |

## Repository layout

```
apps/
  api/          Express REST API + Prisma schema, migrations and seed
  storefront/   Customer website            → http://localhost:3000
  admin/        Admin dashboard             → http://localhost:3001
packages/
  config/       Shared tsconfig + ESLint presets
  types/        Shared enums, API response types, money helpers
  validation/   Zod schemas shared by the API and both frontends
  ui/           Design tokens (Tailwind theme) + base React components
scripts/        Dev helper scripts
```

## Getting started

### Prerequisites

- **Node.js 22** (`nvm use` reads `.nvmrc`)
- **pnpm 10** (`corepack enable` sets it up from `package.json`)
- **Docker** for Postgres and Redis, or a local PostgreSQL 16

### Setup

```bash
pnpm install          # install all workspaces
pnpm env:init         # create .env files from the .env.example templates
pnpm db:up            # start Postgres + Redis in Docker
pnpm db:deploy        # apply database migrations
pnpm db:seed          # load demo hoodies, admin user, shipping zones, pages...
pnpm dev              # start the API, storefront and admin together
```

| App        | URL                                                     |
| ---------- | ------------------------------------------------------- |
| Storefront | http://localhost:3000                                   |
| Admin      | http://localhost:3001                                   |
| API        | http://localhost:4000/api/v1 (health: `/api/v1/health`) |

### Demo accounts (development seed)

| Role        | Email                   | Password                                                                  |
| ----------- | ----------------------- | ------------------------------------------------------------------------- |
| Super Admin | `admin@hoodie.local`    | value of `SEED_ADMIN_PASSWORD` in `apps/api/.env` (default `ChangeMe123`) |
| Customer    | `customer@hoodie.local` | `Customer123`                                                             |

Login arrives in Phase 1. The accounts are already in the database.

### What the seed loads

- 4 categories, 3 collections
- 8 hoodies (7 active, 1 draft) with **90 size × colour variants**, including sold-out and low-stock variants to exercise those UI states
- 3 shipping zones (Lahore, major cities, rest of Pakistan) with COD fees
- 3 coupons (`WELCOME10`, `FREESHIP`, `WINTER500`), 2 homepage banners
- Policy pages, FAQs, and store settings

The seed is **idempotent**, so you can run it again at any time. In `NODE_ENV=production` it only seeds essentials (admin, settings, shipping, pages, FAQ), and it refuses the example admin password.

## Scripts

Run from the repo root:

| Command                             | What it does                                                     |
| ----------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                          | Run all apps in watch mode                                       |
| `pnpm build`                        | Production build of every app                                    |
| `pnpm lint`                         | ESLint everywhere                                                |
| `pnpm typecheck`                    | TypeScript checks everywhere                                     |
| `pnpm test`                         | Unit and integration tests (the API tests need Postgres running) |
| `pnpm format` / `pnpm format:check` | Prettier                                                         |
| `pnpm db:migrate`                   | Create a new migration after editing `schema.prisma` (dev)       |
| `pnpm db:deploy`                    | Apply pending migrations (CI / production)                       |
| `pnpm db:seed`                      | Seed the database                                                |
| `pnpm db:reset`                     | Drop, re-migrate and re-seed the dev database                    |
| `pnpm db:studio`                    | Open Prisma Studio to browse data                                |

Run one app or package with a filter, e.g. `pnpm --filter @hoodie/api dev`.

## Conventions

- **Money is always an integer in minor units** (paisa): `349900` = Rs 3,499. Use `formatMoney()` from `@hoodie/types` for display. Never use floats.
- **Validation lives in `@hoodie/validation`.** The same Zod schema validates the frontend form and the API request.
- **Enums live in two places**: the Prisma schema and `@hoodie/types`. A test (`apps/api/test/enums.test.ts`) fails if they drift apart.
- **API responses** use `{ data }` / `{ data, meta }` on success and `{ error: { code, message, details, requestId } }` on failure. Throw `AppError` from services; the error handler formats the response.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:`…), enforced by commitlint. Prettier runs on staged files before each commit.
- **Branches:** `main` (production), `develop` (staging), `feature/*` with pull requests.

## CI

`.github/workflows/ci.yml` runs on every push and PR: install → format check → lint → typecheck → migrate + seed a Postgres service → tests → build.
