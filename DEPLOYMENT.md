# Deploying Urban Store on Vercel

Urban Store is **one Vercel project** with a free Neon Postgres database. The
same site serves:

| Address                      | What it is                          |
| ---------------------------- | ----------------------------------- |
| `urbanstore-one.vercel.app/` | The shop customers use              |
| `.../admin`                  | The admin panel for staff           |
| `.../api/v1`                 | The backend (orders, stock, emails) |

Everything here works on Vercel's free (Hobby) plan and Neon's free plan. Vercel's
Hobby plan is meant for non-commercial use, so move to Pro once the shop is
taking real orders.

## 1. Project settings

In your Vercel project (`urbanstore`): **Settings → Build and Deployment**.

- **Root Directory: `apps/storefront`**.
- Framework Preset: **Next.js**.
- Leave the build, output and install commands empty. They come from
  `apps/storefront/vercel.json`.

## 2. The database (free)

**Storage → Create Database → Neon (Postgres)**. Choose the **Singapore** region
(closest to Pakistan, and where the functions run) and the free plan, then
**Connect** it to the `urbanstore` project. This adds `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` automatically.

## 3. Environment variables

**Settings → Environment Variables**, for Production and Preview:

| Name                  | Value                                                      |
| --------------------- | ---------------------------------------------------------- |
| `JWT_ACCESS_SECRET`   | random text, at least 32 characters                        |
| `CRON_SECRET`         | different random text, at least 32 characters              |
| `SEED_ADMIN_EMAIL`    | your email: the first admin account                        |
| `SEED_ADMIN_PASSWORD` | the first admin password (a strong one, not `ChangeMe123`) |

For the random values, run `openssl rand -hex 32` or use any password generator
with a long length. Keep them private and never put them in the repository.

That's all. The site's own address is used automatically for links in emails.
If you add a custom domain, also add `STOREFRONT_URL` = `https://your-domain`.

Optional: `REDIS_URL` (e.g. a free Upstash Redis) shares rate limits between
function instances. Without it each instance keeps its own.

## 4. Deploy

**Deployments → Redeploy** (or push to `main`). The build:

1. creates or updates the database tables;
2. creates your admin account and the store settings, shipping zones and pages;
3. the first time only, adds the Urban Store catalogue. Later deploys never
   overwrite what you change in the admin;
4. builds the site.

Only **production** deploys (from `main`) change the database. Preview deploys
of other branches just build the site, so an unmerged change can never migrate
or seed the live store.

Check `https://<your-site>/api/v1/health` shows `"status":"ok"`.

## 5. After the first deploy

1. Open `https://<your-site>/admin` and sign in with `SEED_ADMIN_EMAIL` /
   `SEED_ADMIN_PASSWORD`.
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

- **One Next.js app** (`apps/storefront`): the shop in `app/(shop)`, the admin
  panel in `app/admin`, and the API at `app/api/v1/[...path]`. The API route
  hands each request to the Express app from `apps/api`, in the same process,
  so there is no proxy and login cookies are first-party. Server-rendered pages
  read data from the API in-process too, without an HTTP round trip.
- Shop and admin share the site, so a staff member signed in to the admin is
  also signed in to the shop.
- Emails are sent before the function finishes (`waitUntil`).
- **Scheduled jobs:** Vercel Cron calls `/api/v1/cron/daily` at 08:00 Pakistan
  time with the `CRON_SECRET`. It expires unpaid card orders, sends abandoned-cart
  reminders and review requests, and emails the daily summary.
- **Images:** the catalogue photos come from Unsplash's CDN (free to use).
  Photos you upload in the admin are resized in your browser and stored in the
  database, so no Cloudinary account is needed. Unsplash resizes its photos
  itself, so no Vercel image-optimisation quota is used.
- **Payments:** Cash on Delivery only. Card payments stay switched off until
  Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`) are added.
- **Database:** the functions use Neon's pooled connection; migrations use the
  direct one (`DATABASE_URL_UNPOOLED`). Neon keeps point-in-time restore for
  backups.

## Custom domain

Add the domain under **Settings → Domains** (e.g. `urbanstore.pk`), set
`STOREFRONT_URL` = `https://urbanstore.pk`, and redeploy. The admin is then at
`urbanstore.pk/admin`.
