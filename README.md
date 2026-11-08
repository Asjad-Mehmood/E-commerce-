# Urban Store

**Urban Store** sells everyday streetwear hoodies across Pakistan. This one TypeScript monorepo holds a customer **storefront**, an **admin dashboard** and a **REST API**.

- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: going live on Vercel with a free Neon Postgres database, step by step.
- **[PLAN.md](./PLAN.md)**: the full project plan and roadmap.

> **Status: all six phases complete, ready to launch.**
>
> - **Shopping:** customers browse a real catalogue (Rs 2,699–5,499) with typo-tolerant search and order by Cash on Delivery.
> - **After buying:** they track and cancel orders, review what they bought, keep a wishlist and request returns.
> - **Admin:** staff run everything from the admin panel. Email is set up there too, and nothing is sent until it is.
> - **Images:** stored in the database, so no Cloudinary account is needed.

---

## Tech stack

| Part                     | Tech                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Site (`apps/storefront`) | Next.js 15 (App Router), React 19, Tailwind CSS 4: the shop, `/admin` and `/api/v1`       |
| API (`apps/api`)         | Node 22, Express 5, Prisma 6, PostgreSQL 16, Zod 4, Pino                                  |
| Shared                   | `@hoodie/types`, `@hoodie/validation`, `@hoodie/ui`, `@hoodie/config`                     |
| Tooling                  | pnpm workspaces, Turborepo, ESLint 9, Prettier, Vitest, Husky, commitlint, GitHub Actions |

## Repository layout

```
apps/
  storefront/   The site → http://localhost:3000
    app/(shop)/          customer pages
    app/admin/, admin/   admin panel (/admin) and its components
    app/api/v1/          serves the API below at /api/v1
  api/          Express REST API (served by the site) + Prisma schema, migrations, seed
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
pnpm dev              # start the site (shop, admin and API) at http://localhost:3000
```

| Part               | URL                                                                         |
| ------------------ | --------------------------------------------------------------------------- |
| Shop               | http://localhost:3000                                                       |
| Admin              | http://localhost:3000/admin                                                 |
| API                | http://localhost:3000/api/v1 (health: `/api/v1/health`)                     |
| API docs (Swagger) | `pnpm --filter @hoodie/api dev:server`, then http://localhost:4000/api/docs |

The site reads the API's settings (database, secrets) from `apps/api/.env`.

### Demo accounts (development seed)

| Role        | Email                   | Password                                                                  |
| ----------- | ----------------------- | ------------------------------------------------------------------------- |
| Super Admin | `admin@hoodie.local`    | value of `SEED_ADMIN_PASSWORD` in `apps/api/.env` (default `ChangeMe123`) |
| Customer    | `customer@hoodie.local` | `Customer123`                                                             |

Sign in to the admin panel at http://localhost:3000/admin with the Super Admin account. Invite more staff from **Staff** in the admin panel.

### What the seed loads

- 5 categories (pullover, zip-up, oversized, custom, women's), 3 collections
- 9 hoodies (8 active, 1 draft) priced like Pakistani streetwear brands, with real photos (Unsplash, free for commercial use) per colour and **114 size × colour variants**, including sold-out and low-stock variants to exercise those UI states
- 3 shipping zones (Lahore, major cities, rest of Pakistan) with COD fees
- 3 coupons (`WELCOME10`, `FREESHIP`, `WINTER500`), 3 homepage banners
- Shipping, returns, privacy and terms pages, FAQs, and store settings (Cash on Delivery only)
- 7 approved demo reviews on 4 products (from three demo reviewer accounts without passwords)

The seed is **idempotent**, so you can run it again at any time. In `NODE_ENV=production` it seeds the essentials (admin, settings, shipping, pages, FAQ), plus the catalogue and banners the first time only (each size starts with 20 in stock). It never adds demo customers, reviews or coupons, and it refuses the example admin password.

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

| Page                                               | Route                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Home                                               | `/`                                                                                          |
| Shop / category / collection / search              | `/shop`, `/categories/[slug]`, `/collections/[slug]`, `/search?q=`                           |
| Product                                            | `/products/[slug]`                                                                           |
| Cart                                               | `/cart` (plus the slide-out cart drawer on every page)                                       |
| Checkout / payment / order / tracking              | `/checkout`, `/checkout/pay`, `/orders/[number]`, `/track-order`                             |
| Sign in / register / password reset / verify email | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`                |
| Account                                            | `/account`, `/account/orders`, `/account/wishlist`, `/account/profile`, `/account/addresses` |
| Email preferences                                  | `/unsubscribe` (from links in emails)                                                        |
| Content                                            | `/size-guide`, `/faq`, `/about`, `/contact`, `/policies/[slug]`                              |

How it is built:

- **Catalogue pages render on the server** and call the API with a short cache (60 seconds for products, 5 minutes for menus and content). The build never needs a running API.
- **Filters live in the URL** (`/shop?size=M&color=Navy&sort=price_asc`), so filtered pages can be shared and indexed. Controls update instantly while results load.
- **The session and cart are client-side** (TanStack Query) and talk to the API with cookies. An expired session is refreshed automatically.
- **Forms use the same Zod schemas as the API** (`@hoodie/validation`), and API field errors appear next to the right field.
- **SEO:** per-page metadata, Product and FAQ JSON-LD (with review ratings), `sitemap.xml`, `robots.txt`, and real 404 status codes for missing products, categories and pages.

Engagement features (Phase 5):

- **Search** opens from the header with suggestions as you type (products and categories, keyboard navigable). It tolerates typos ("hodie", "sherpaa") using PostgreSQL trigram matching, and full results sort by best match.
- **Reviews** on product pages: rating summary with a filter per star rating, sorting, and a form for customers whose order containing the product was delivered. Reviews appear after staff publish them (or straight away if auto-publish is on). Product cards show the average rating.
- **Wishlist:** a heart on every product card and product page; saved items at `/account/wishlist`. Guests are asked to sign in.
- **Recently viewed** products are remembered on the device (localStorage) and shown on product pages and the home page.
- **Returns:** on a delivered order, within the return window (14 days by default), customers choose items and a reason; the order page then shows each return's progress.
- **Google sign-in** appears on the login and register pages once `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set on the API.
- **"You may also like"** shows products often bought together first, then best sellers from the same category.

### End-to-end tests

```bash
pnpm build      # all apps must be built
pnpm e2e        # starts the site if it isn't running, then runs Playwright
```

There are 51 tests on desktop, mobile (Pixel 7) and the admin panel. They cover browsing, filters, sorting, search (including suggestions with a typo), the size guide, the cart, sold-out and low-stock states, registering with a guest cart, addresses, signing out and in, the mobile menu and filters, checkout (Cash on Delivery, demo card payments with a decline then success, coupons, saved addresses, tracking and cancelling), wishlist, recently viewed, reviews, returns, unsubscribe links, and the admin (sign-in and access rules, fulfilling and refunding orders, creating a product with variants and stock, coupons, the dashboard, publishing a review, and a return from approval to refund), plus automated **accessibility checks** (axe, WCAG 2.1 AA) on 14 storefront pages and 10 admin pages. Card tests switch demo card payments on for the run and off again afterwards. They run against the database in `apps/api/.env`, create uniquely named `@test.local` users, and sign in to the admin with `SEED_ADMIN_PASSWORD` (or `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`). If the site is already running, start it with `RATE_LIMIT_ENABLED=false` and `ALLOW_DEMO_PAYMENTS=true`, because the tests sign in more than five times a minute and use demo cards.

## Admin panel

http://localhost:3000/admin (staff accounts only; customer accounts are refused). Routes below are under `/admin`.

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

**Returns** (`/returns`): approve (the customer is emailed the store address), mark the parcel received (restocking by default), then a manager refunds the items' value. Declining sends the customer your reason. **Reviews** (`/reviews`): publish, hide, reply publicly or delete. **Newsletter** (`/newsletter`): subscribers with CSV export for your email tool.

**New orders** show as a badge and a pop-up within 30 seconds (the admin polls `GET /admin/notifications`), alongside counts of returns and reviews waiting.

**Image uploads** need no account. The admin resizes each photo in the browser (longest side 1,600 px, WebP), and the API stores it in Postgres and serves it from `/api/v1/media/…` with year-long caching. If Cloudinary keys are set, uploads go straight to Cloudinary instead.

**Email** is set up in **Store settings → Email**: SMTP (Gmail with an app password, Outlook, Zoho, your host) or Resend. Passwords and keys are stored encrypted, and you can send a test email from there. **Until email is set up, nothing is sent at all.** Orders still work: the confirmation page tells customers to bookmark their order link, and staff invitations show a link to pass on by hand.

## Background jobs and emails

With `REDIS_URL` set, the API runs a **BullMQ** worker. Emails are queued and retried with backoff (about two hours of attempts), and these jobs run on a schedule:

| Job                  | When               | What it does                                                                                                         |
| -------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Expire unpaid orders | Every minute       | Releases stock held by card orders not paid within 15 minutes                                                        |
| Cart reminders       | Every 15 minutes   | Emails signed-in customers who left items in their cart: after 1 hour, then after 1 day. Any cart change restarts it |
| Daily summary        | 08:00 store time   | Yesterday's sales and what needs attention, to managers and Super Admins (switch off in Store settings)              |
| Back-in-stock        | When stock goes up | Emails everyone who asked to be told about that size and colour, once                                                |
| Review requests      | Every hour         | "How's your hoodie?" a week after delivery, with links to review what they haven't reviewed yet                      |

Every marketing email (newsletter welcome, cart reminders) has a signed unsubscribe link; the storefront asks for a click before unsubscribing, because some email scanners open every link. Order emails are always sent.

The worker runs inside the API by default. To run it separately, set `RUN_WORKER=false` on the API servers and start `node apps/api/dist/worker.js`. **Without Redis** the recurring jobs run on simple timers inside the API, emails are sent straight away, and the daily summary email is skipped. This applies to the standalone API server (`node apps/api/dist/server.js`). **In the site** (`apps/storefront`, and so on Vercel) there is no worker: emails are sent straight away and Vercel Cron calls `GET /api/v1/cron/daily` (with `CRON_SECRET`) once a day to run all the scheduled jobs.

## Checkout and payments

1. **Cart → checkout.** The checkout page asks the API for a live quote (`POST /checkout/quote`) whenever the city, delivery method or payment method changes. Shipping comes from the shipping zone for the city, with free standard delivery over the zone's threshold.
2. **Place the order** (`POST /checkout`). In one database transaction every line is **sold** (Cash on Delivery) or **reserved** (card) with an atomic conditional update, so if any line is short the whole order rolls back. Orders get sequential numbers (`US-10001`…). Re-sending the same `idempotencyKey` returns the same order, so a double click can't create two.
3. **Cash on Delivery** (the only method unless Stripe keys are added) orders are confirmed immediately, and the customer gets a confirmation email once email is set up.
4. **Card** orders wait for payment for 15 minutes. Success turns the reservation into a sale and sends the confirmation email. A declined card can be retried. If the time runs out, a job releases the stock.
5. **After the order:** the customer sees it at `/orders/US-…?token=…` (the link in the email) or in their account. They can track it at `/track-order`, cancel it before it's prepared, and download a PDF invoice. Staff move orders along in the admin panel (processing → shipped → delivered), which emails the customer.

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
3. Point a webhook at `https://<your-api>/api/v1/payments/stripe/webhook` for `payment_intent.succeeded` and `payment_intent.payment_failed`. Locally: `stripe listen --forward-to localhost:3000/api/v1/payments/stripe/webhook`.
4. Restart the API. The checkout then shows Stripe's Payment Element, and card details go straight to Stripe.

## API

Interactive docs are at **`/api/docs`**, and the raw OpenAPI 3.1 spec at `/api/docs/openapi.json`. The spec is generated from the route definitions, so it stays in sync with the code.

| Area                | Endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password` · `PATCH /auth/password` · `GET /auth/me`, `/auth/session`, `/auth/providers`, `/auth/google` (+ `/callback`)                                                                                                                                                                                                                                                                                                           |
| Account             | `PATCH /me` · `GET/POST /me/addresses` · `PUT/DELETE /me/addresses/:id` · `GET /me/wishlist` (+ `/ids`) · `PUT/DELETE /me/wishlist/:productId`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Catalog             | `GET /products` (filters, search with `sort=relevance`, `slugs=` for recently viewed, pages) · `/products/:slug` · `/products/:slug/related` · `/search/suggest` · `/categories[/:slug]` · `/collections[/:slug]` · `/filters` · `GET/PUT/DELETE /products/:slug/reviews` (+ `/eligibility`)                                                                                                                                                                                                                                                                   |
| Cart                | `GET/DELETE /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Content             | `GET /cms/home`, `/cms/pages/:slug`, `/cms/faq` · `POST /contact`, `/newsletter`, `/stock-alerts`, `/email-preferences/unsubscribe`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Checkout & orders   | `POST /cart/coupon` · `POST /checkout/quote`, `/checkout` · `GET /orders/track`, `/orders/:number`, `/orders/:number/payment`, `/orders/:number/invoice` · `POST /orders/:number/cancel`, `/orders/:number/returns` · `GET /me/orders`                                                                                                                                                                                                                                                                                                                         |
| Payments            | `POST /payments/stripe/webhook` · `POST /payments/demo/confirm` (demo mode)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Admin (Support+)    | `GET /admin/dashboard`, `/admin/notifications` · `/admin/orders` (list, `/export` CSV, `/:number`, `PATCH /:number`, `/:number/status`, `/:number/invoice`, `/:number/packing-slip`) · `/admin/customers` · `/admin/messages` (+ `/reply`) · `/admin/returns` (+ `/:id/approve`, `/reject`, `/receive`) · `/admin/reviews`                                                                                                                                                                                                                                     |
| Admin (Manager+)    | `/admin/products` CRUD + `/bulk` + `/variants/generate` · `/admin/variants/:id` + `/adjust-stock` · `/admin/inventory` (+ `/:variantId/history`) · `/admin/categories` · `/admin/collections` · `/admin/coupons` · `/admin/shipping-zones` · `/admin/banners`, `/pages`, `/faq`, `/announcement` · `/admin/reports/sales`, `/products`, `/categories`, `/inventory` (`?format=csv`) · `POST /admin/orders/:number/refund`, `/admin/returns/:id/refund` · `PATCH /admin/customers/:id/block` · `/admin/newsletter` · `/admin/uploads/config`, `/sign`, `/local` |
| Admin (Super Admin) | `/admin/staff` (+ `/:id/resend-invite`) · `GET/PATCH /admin/settings` · `/admin/audit-log` (+ `/entities`)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### How auth works (for the frontends)

- **Login** sets two httpOnly cookies: `access_token` (the token inside is valid for 15 minutes) and `refresh_token` (30 days, sent only to `/api/v1/auth/*`). Send requests with `credentials: "include"`. Use `GET /auth/session` to check who is signed in: it returns `null` for guests rather than an error.
- When a request returns **401 with `details.reason = "TOKEN_EXPIRED"`**, call `POST /auth/refresh` once and retry. If refresh fails, the user must sign in again.
- **Refresh tokens rotate** on every use. Replaying an old one signs out every session for that user, which limits the damage from a stolen token.
- **Guest carts** live in a `cart_token` cookie and merge into the user's cart automatically on login or register.
- **Roles:** `CUSTOMER` < `SUPPORT` < `MANAGER` < `SUPER_ADMIN`. Changing a role or blocking a user takes effect on their next request.
- **CSRF:** cookies are `SameSite=Lax`, and writes from browser origins outside `CORS_ORIGINS` are rejected.
- **Rate limits** (per IP): login 5/min, register 10/hour, password reset 5 per 15 min, everything else 300/min. They are stored in Redis when `REDIS_URL` is set, so limits hold across multiple API servers.
- **Google sign-in** (when configured) links to an existing account only if Google has verified the email; otherwise the customer must sign in with their password.
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
