# Deploying Urban Store on Vercel

Urban Store is three Vercel projects built from this one repository, plus a free
Neon Postgres database:

| Project            | Root Directory    | What it is                          | Example address               |
| ------------------ | ----------------- | ----------------------------------- | ----------------------------- |
| `urbanstore`       | `apps/storefront` | The shop customers use              | `urbanstore-one.vercel.app`   |
| `urbanstore-admin` | `apps/admin`      | The admin panel for staff           | `urbanstore-admin.vercel.app` |
| `urbanstore-api`   | `apps/api`        | The backend (orders, stock, emails) | `urbanstore-api.vercel.app`   |

Everything here works on Vercel's free (Hobby) plan and Neon's free plan. Vercel's
Hobby plan is meant for non-commercial use, so move to Pro once the shop is
taking real orders.

> **Why the 404?** Vercel builds the repository root by default, and the root has
> no website in it. Each project must point at its app folder (the **Root
> Directory** above), and the code must be on the branch Vercel deploys
> (`main`): merge the pull request first.

## Before you start

1. Merge the pull request into `main`.
2. Make three random secrets (each at least 32 characters). On a Mac or Linux
   terminal run `openssl rand -hex 32` three times, or use any password
   generator. Keep them somewhere safe. They are called **JWT secret**, **proxy
   secret** and **cron secret** below. Never commit them to the repository.

## 1. The API project (`apps/api`)

1. In Vercel: **Add New… → Project**, import this repository.
2. Project name: `urbanstore-api`. **Root Directory: `apps/api`**. Framework
   preset: **Other** (the build settings come from `apps/api/vercel.json`).
3. Before the first deploy, open **Storage → Create Database → Neon (Postgres)**,
   choose the **Singapore** region (closest to Pakistan, and where the functions
   run) and connect it to this project. This adds `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` automatically.
4. Add these **Environment Variables**:

   | Name                  | Value                                                           |
   | --------------------- | --------------------------------------------------------------- |
   | `JWT_ACCESS_SECRET`   | your JWT secret                                                 |
   | `PROXY_SECRET`        | your proxy secret                                               |
   | `CRON_SECRET`         | your cron secret                                                |
   | `STOREFRONT_URL`      | the shop's address, e.g. `https://urbanstore-one.vercel.app`    |
   | `ADMIN_URL`           | the admin's address, e.g. `https://urbanstore-admin.vercel.app` |
   | `SEED_ADMIN_EMAIL`    | your email: the first admin account                             |
   | `SEED_ADMIN_PASSWORD` | the first admin password (not `ChangeMe123`)                    |

   Optional: `REDIS_URL` (e.g. a free Upstash Redis) shares rate limits between
   function instances. Without it each instance keeps its own.

5. **Deploy.** The build creates the tables, your admin account, the store
   settings, shipping zones, pages and, the first time only, the Urban Store
   catalogue. Later deploys never overwrite what you change in the admin.
6. Check `https://urbanstore-api.vercel.app/api/v1/health` shows
   `"status":"ok"`.

## 2. The storefront project (`apps/storefront`)

Use the existing `urbanstore` project (or create one the same way):

1. **Settings → Build and Deployment → Root Directory: `apps/storefront`**.
   Framework preset: **Next.js**. Leave the build and install commands empty.
2. **Environment Variables**:

   | Name           | Value                                      |
   | -------------- | ------------------------------------------ |
   | `API_URL`      | `https://urbanstore-api.vercel.app/api/v1` |
   | `PROXY_SECRET` | the same proxy secret as the API           |

3. **Deployments → Redeploy.**

## 3. The admin project (`apps/admin`)

1. **Add New… → Project**, import the same repository again.
2. Project name: `urbanstore-admin`. **Root Directory: `apps/admin`**.
   Framework preset: **Next.js**.
3. **Environment Variables**:

   | Name                         | Value                                      |
   | ---------------------------- | ------------------------------------------ |
   | `API_URL`                    | `https://urbanstore-api.vercel.app/api/v1` |
   | `PROXY_SECRET`               | the same proxy secret as the API           |
   | `NEXT_PUBLIC_STOREFRONT_URL` | the shop's address                         |

4. **Deploy.**

If Vercel gave a project a different address than you expected (for example
`urbanstore-admin-xyz.vercel.app`), update `STOREFRONT_URL` / `ADMIN_URL` on the
API project and redeploy it: the API only accepts requests from those two
addresses.

## 4. After the first deploy

1. Sign in to the admin with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
2. **Inventory:** every size starts with 20 in stock. Set your real stock.
3. **Store settings:** check the store name, phone, address and return window.
4. **Store settings → Email:** until this is set up the shop sends no email at
   all. Orders still work, and customers see their order on screen. When you're
   ready:
   - Gmail: turn on 2-Step Verification, create an **App password** (Google
     Account → Security → App passwords), choose **SMTP → Gmail** and paste it.
   - Or use Resend with an API key from resend.com.
   - Press **Send test email** to check.
5. **Staff:** invite your team. While email is off you get a link to send them
   yourself.

## How it fits together

- The browser only ever talks to the shop's (or the admin's) own address. Each
  Next.js app proxies `/api/v1/*` to the API (`middleware.ts`), so login cookies
  are first-party. The proxy passes on the shopper's IP, vouched for by
  `PROXY_SECRET`, so rate limits apply per shopper.
- The API runs as one Vercel function (`apps/api/api/index.js` →
  `dist/vercel.js`). Emails are sent before the function finishes
  (`waitUntil`).
- **Scheduled jobs:** Vercel Cron calls `/api/v1/cron/daily` at 08:00 Pakistan
  time with the `CRON_SECRET`. It expires unpaid card orders, sends abandoned-cart
  reminders and review requests, and emails the daily summary.
- **Images:** the catalogue photos come from Unsplash's CDN (free to use).
  Photos you upload in the admin are resized in your browser and stored in the
  database, so no Cloudinary account is needed. Unsplash resizes its photos
  itself, so no Vercel image-optimisation quota is used.
- **Payments:** Cash on Delivery only. Card payments stay switched off until
  Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`) are added to the API project.
- **Database:** the functions use Neon's pooled connection; migrations use the
  direct one (`DATABASE_URL_UNPOOLED`). Run `pnpm --filter @hoodie/api db:studio`
  locally with the Neon URL to browse the data.

## Custom domain

Add the domain to the storefront project (**Settings → Domains**), e.g.
`urbanstore.pk`, and optionally `admin.urbanstore.pk` to the admin project.
Then update `STOREFRONT_URL` / `ADMIN_URL` on the API project and redeploy it.
