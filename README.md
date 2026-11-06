# Hoodie Store

A full-stack e-commerce store for hoodies: a customer **storefront**, an **admin dashboard**, and a **REST API**, in one TypeScript monorepo.

See **[PLAN.md](./PLAN.md)** for the full project plan and roadmap.

> **Status: Phase 4 (admin dashboard) complete.** Customers can browse, buy (Cash on Delivery, or card in demo mode until Stripe keys are added), track and cancel orders. Staff run the store from the admin panel: orders, refunds, products, stock, customers, coupons, shipping, content, reports, staff and settings. Next up is Phase 5 (reviews, wishlist, returns and alerts).

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

| App                | URL                                                     |
| ------------------ | ------------------------------------------------------- |
| Storefront         | http://localhost:3000                                   |
| Admin              | http://localhost:3001                                   |
| API                | http://localhost:4000/api/v1 (health: `/api/v1/health`) |
| API docs (Swagger) | http://localhost:4000/api/docs                          |

### Demo accounts (development seed)

| Role        | Email                   | Password                                                                  |
| ----------- | ----------------------- | ------------------------------------------------------------------------- |
| Super Admin | `admin@hoodie.local`    | value of `SEED_ADMIN_PASSWORD` in `apps/api/.env` (default `ChangeMe123`) |
| Customer    | `customer@hoodie.local` | `Customer123`                                                             |

Sign in to the admin panel at http://localhost:3001 with the Super Admin account. Invite more staff from **Staff** in the admin panel.

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
| `pnpm e2e`                          | Playwright end-to-end tests (build first)                        |
| `pnpm format` / `pnpm format:check` | Prettier                                                         |
| `pnpm db:migrate`                   | Create a new migration after editing `schema.prisma` (dev)       |
| `pnpm db:deploy`                    | Apply pending migrations (CI / production)                       |
| `pnpm db:seed`                      | Seed the database                                                |
| `pnpm db:reset`                     | Drop, re-migrate and re-seed the dev database                    |
| `pnpm db:studio`                    | Open Prisma Studio to browse data                                |

Run one app or package with a filter, e.g. `pnpm --filter @hoodie/api dev`.

## Storefront

| Page                                               | Route                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Home                                               | `/`                                                                           |
| Shop / category / collection / search              | `/shop`, `/categories/[slug]`, `/collections/[slug]`, `/search?q=`            |
| Product                                            | `/products/[slug]`                                                            |
| Cart                                               | `/cart` (plus the slide-out cart drawer on every page)                        |
| Checkout / payment / order / tracking              | `/checkout`, `/checkout/pay`, `/orders/[number]`, `/track-order`              |
| Sign in / register / password reset / verify email | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` |
| Account                                            | `/account`, `/account/orders`, `/account/profile`, `/account/addresses`       |
| Content                                            | `/size-guide`, `/faq`, `/about`, `/contact`, `/policies/[slug]`               |

How it is built:

- **Catalogue pages render on the server** and call the API with a short cache (60 seconds for products, 5 minutes for menus and content). The build never needs a running API.
- **Filters live in the URL** (`/shop?size=M&color=Navy&sort=price_asc`), so filtered pages can be shared and indexed. Controls update instantly while results load.
- **The session and cart are client-side** (TanStack Query) and talk to the API with cookies. An expired session is refreshed automatically.
- **Forms use the same Zod schemas as the API** (`@hoodie/validation`), and API field errors appear next to the right field.
- **SEO:** per-page metadata, Product and FAQ JSON-LD, `sitemap.xml`, `robots.txt`, and real 404 status codes for missing products, categories and pages.

### End-to-end tests

```bash
pnpm build      # all apps must be built
pnpm e2e        # starts the API, storefront and admin if they aren't running, then runs Playwright
```

There are 29 tests on desktop, mobile (Pixel 7) and the admin panel. They cover browsing, filters, sorting, search, the size guide, the cart, sold-out and low-stock states, registering with a guest cart, addresses, signing out and in, the mobile menu and filters, checkout (Cash on Delivery, demo card payments with a decline then success, coupons, saved addresses, tracking and cancelling), and the admin (sign-in and access rules, fulfilling and refunding orders, creating a product with variants and stock, coupons, the dashboard). They run against the database in `apps/api/.env`, create uniquely named `@test.local` users, and sign in to the admin with `SEED_ADMIN_PASSWORD` (or `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`). If the API is already running, start it with `RATE_LIMIT_ENABLED=false`, because the tests sign in more than five times a minute.

## Admin panel

http://localhost:3001 (staff accounts only; customer accounts are refused).

| Module         | Route                                 | What staff can do                                                                                                                                                                                                   |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard      | `/`                                   | Net sales, orders, average order value and new customers for 7/30/90 days with the change from the previous period; daily sales chart (with a table view); top products; low stock; recent orders; orders to fulfil |
| Orders         | `/orders`, `/orders/[number]`         | Filter by status, payment, dates; search by number, email, phone or name; CSV export. Fulfil (prepare → ship with courier and tracking → deliver), cancel, refund, notes, invoice and packing slip PDFs             |
| Customers      | `/customers`, `/customers/[id]`       | Lifetime value and order history, addresses, private notes, block / unblock                                                                                                                                         |
| Messages       | `/messages`                           | Contact form inbox: read, reply by email, archive                                                                                                                                                                   |
| Products       | `/products`, `/products/new`, `/[id]` | Search and filter, bulk publish / draft / archive. Editor with images (upload, alt text, colour tags, order), size × colour generator, per-variant SKU, price, low-stock alert, on/off and stock adjustments        |
| Inventory      | `/inventory`                          | Every variant's stock, held and available units; low / out-of-stock filters; adjust with a reason and see the history                                                                                               |
| Categories     | `/categories`, `/collections`         | Create, edit, nest, images, order                                                                                                                                                                                   |
| Coupons        | `/coupons`                            | Percentage, fixed or free delivery; minimum order; total and per-customer limits; start and end dates                                                                                                               |
| Content        | `/content`                            | Announcement bar, homepage banners (scheduling), policy pages, FAQ                                                                                                                                                  |
| Reports        | `/reports`                            | Sales by day / week / month, best sellers, sales by category, inventory value, all downloadable as CSV                                                                                                              |
| Shipping       | `/settings/shipping`                  | Delivery zones by city, standard and express rates, free-delivery threshold, Cash on Delivery fee                                                                                                                   |
| Staff          | `/staff`                              | Invite by email (the invitee sets a password), change role, deactivate, remove                                                                                                                                      |
| Store settings | `/settings`                           | Store details for invoices, payment methods, tax, return window; shows how payments, email and uploads are configured                                                                                               |
| Activity log   | `/audit-log`                          | Who changed what and when                                                                                                                                                                                           |

**Roles.** Support: orders, customers, messages. Manager: also products, stock, coupons, content, reports and refunds. Super Admin: also staff, settings and the activity log. The menu only shows what a role can use, and the API enforces the same rules.

**Refunds.** Card payments are refunded through Stripe (or the demo provider). Cash on Delivery refunds are recorded for staff to pay back. A full refund marks the order Refunded and, if it hadn't shipped, puts the items back in stock: this is how a paid card order is cancelled. Two staff can't refund the same money twice.

**New orders** show as a badge and a pop-up within 30 seconds (the admin polls `GET /admin/notifications`).

**Image uploads** go straight to Cloudinary when its keys are set. Without them (development), images are saved to `apps/api/uploads` and served by the API. In production, use Cloudinary or set `LOCAL_UPLOADS=true` with a persistent disk.

## Checkout and payments

1. **Cart → checkout.** The checkout page asks the API for a live quote (`POST /checkout/quote`) whenever the city, delivery method or payment method changes. Shipping comes from the shipping zone for the city, with free standard delivery over the zone's threshold.
2. **Place the order** (`POST /checkout`). In one database transaction every line is **sold** (Cash on Delivery) or **reserved** (card) with an atomic conditional update, so if any line is short the whole order rolls back. Orders get sequential numbers (`HD-10001`…). Re-sending the same `idempotencyKey` returns the same order, so a double click can't create two.
3. **Cash on Delivery** orders are confirmed immediately, and the customer gets a confirmation email.
4. **Card** orders wait for payment for 15 minutes. Success turns the reservation into a sale and sends the confirmation email. A declined card can be retried. If the time runs out, a job releases the stock.
5. **After the order:** the customer sees it at `/orders/HD-…?token=…` (the link in the email) or in their account. They can track it at `/track-order`, cancel it before it's prepared, and download a PDF invoice. Staff move orders along in the admin panel (processing → shipped → delivered), which emails the customer.

### Demo payment mode (default)

Without Stripe keys, card payments use a built-in **demo mode** that behaves like Stripe's test mode. No money moves, and only Stripe's public test cards are accepted:

| Card                  | Result             |
| --------------------- | ------------------ |
| `4242 4242 4242 4242` | Succeeds           |
| `4000 0000 0000 0002` | Declined           |
| `4000 0000 0000 9995` | Insufficient funds |

Use any future expiry date and any CVC. Demo mode is **off in production** unless `ALLOW_DEMO_PAYMENTS=true`, so a misconfigured live store offers Cash on Delivery only.

### Switching to real Stripe

1. Create a Stripe account and copy the test keys from the Stripe dashboard.
2. In `apps/api/.env`, set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET`.
3. Point a webhook at `https://<your-api>/api/v1/payments/stripe/webhook` for `payment_intent.succeeded` and `payment_intent.payment_failed`. Locally: `stripe listen --forward-to localhost:4000/api/v1/payments/stripe/webhook`.
4. Restart the API. The checkout then shows Stripe's Payment Element, and card details go straight to Stripe.

## API

Interactive docs are at **`/api/docs`**, and the raw OpenAPI 3.1 spec at `/api/docs/openapi.json`. The spec is generated from the route definitions, so it stays in sync with the code.

| Area                | Endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password` · `PATCH /auth/password` · `GET /auth/me`, `/auth/session`                                                                                                                                                                                                                                                                                                           |
| Account             | `PATCH /me` · `GET/POST /me/addresses` · `PUT/DELETE /me/addresses/:id`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Catalog             | `GET /products` (filters, search, sort, pages) · `/products/:slug` · `/products/:slug/related` · `/categories[/:slug]` · `/collections[/:slug]` · `/filters`                                                                                                                                                                                                                                                                                                                                                |
| Cart                | `GET/DELETE /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:id`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Content             | `GET /cms/home`, `/cms/pages/:slug`, `/cms/faq` · `POST /contact`, `/newsletter`, `/stock-alerts`                                                                                                                                                                                                                                                                                                                                                                                                           |
| Checkout & orders   | `POST /cart/coupon` · `POST /checkout/quote`, `/checkout` · `GET /orders/track`, `/orders/:number`, `/orders/:number/payment`, `/orders/:number/invoice` · `POST /orders/:number/cancel` · `GET /me/orders`                                                                                                                                                                                                                                                                                                 |
| Payments            | `POST /payments/stripe/webhook` · `POST /payments/demo/confirm` (demo mode)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Admin (Support+)    | `GET /admin/dashboard`, `/admin/notifications` · `/admin/orders` (list, `/export` CSV, `/:number`, `PATCH /:number`, `/:number/status`, `/:number/invoice`, `/:number/packing-slip`) · `/admin/customers` · `/admin/messages` (+ `/reply`)                                                                                                                                                                                                                                                                  |
| Admin (Manager+)    | `/admin/products` CRUD + `/bulk` + `/variants/generate` · `/admin/variants/:id` + `/adjust-stock` · `/admin/inventory` (+ `/:variantId/history`) · `/admin/categories` · `/admin/collections` · `/admin/coupons` · `/admin/shipping-zones` · `/admin/banners`, `/pages`, `/faq`, `/announcement` · `/admin/reports/sales`, `/products`, `/categories`, `/inventory` (`?format=csv`) · `POST /admin/orders/:number/refund` · `PATCH /admin/customers/:id/block` · `/admin/uploads/config`, `/sign`, `/local` |
| Admin (Super Admin) | `/admin/staff` (+ `/:id/resend-invite`) · `GET/PATCH /admin/settings` · `/admin/audit-log` (+ `/entities`)                                                                                                                                                                                                                                                                                                                                                                                                  |

### How auth works (for the frontends)

- **Login** sets two httpOnly cookies: `access_token` (the token inside is valid for 15 minutes) and `refresh_token` (30 days, sent only to `/api/v1/auth/*`). Send requests with `credentials: "include"`. Use `GET /auth/session` to check who is signed in: it returns `null` for guests rather than an error.
- When a request returns **401 with `details.reason = "TOKEN_EXPIRED"`**, call `POST /auth/refresh` once and retry. If refresh fails, the user must sign in again.
- **Refresh tokens rotate** on every use. Replaying an old one signs out every session for that user, which limits the damage from a stolen token.
- **Guest carts** live in a `cart_token` cookie and merge into the user's cart automatically on login or register.
- **Roles:** `CUSTOMER` < `SUPPORT` < `MANAGER` < `SUPER_ADMIN`. Changing a role or blocking a user takes effect on their next request.
- **CSRF:** cookies are `SameSite=Lax`, and writes from browser origins outside `CORS_ORIGINS` are rejected.
- **Rate limits** (per IP): login 5/min, register 10/hour, password reset 5 per 15 min, everything else 300/min. They are stored in Redis when `REDIS_URL` is set, so limits hold across multiple API servers.
- **Emails** (verification, password reset) are printed to the API log in development. Set `RESEND_API_KEY` to send real ones.

### Tests

`pnpm test` runs the API tests against a **separate database**: `hoodie_store_test`, or `TEST_DATABASE_URL` if set. It is migrated and seeded automatically and never wiped. Each test creates uniquely named data, so the suite can be re-run at any time without touching development data.

## Conventions

- **Money is always an integer in minor units** (paisa): `349900` = Rs 3,499. Use `formatMoney()` from `@hoodie/types` for display. Never use floats.
- **Validation lives in `@hoodie/validation`.** The same Zod schema validates the frontend form and the API request.
  - Zod 4 applies `.default()` values even inside `.partial()`. Define each resource's fields once without defaults, add defaults only in the create schema, and keep the update schema a plain `.partial()`. Otherwise a PATCH silently resets fields. A test enforces this.
- **Routes are declared with `defineRoutes()`** (`apps/api/src/lib/route.ts`). Each route states its access level, body/query schema and rate limit. Validation, auth and the API docs all come from that one definition.
- **Enums live in two places**: the Prisma schema and `@hoodie/types`. A test (`apps/api/test/enums.test.ts`) fails if they drift apart.
- **API responses** use `{ data }` / `{ data, meta }` on success and `{ error: { code, message, details, requestId } }` on failure. Throw `AppError` from services; the error handler formats the response.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `chore:`…), enforced by commitlint. Prettier runs on staged files before each commit.
- **Branches:** `main` (production), `develop` (staging), `feature/*` with pull requests.

## CI

`.github/workflows/ci.yml` runs on every push and PR: install → format check → lint → typecheck → migrate + seed a Postgres service → tests → build.
