/**
 * Vercel build for the whole store (vercel.json `buildCommand`), run from
 * apps/storefront:
 *   1. build the API package (Prisma client + apps/api/dist);
 *   2. production only: apply database migrations over the direct (unpooled)
 *      connection, then seed the essentials (admin account, settings,
 *      shipping, pages and, on the very first deploy, the catalogue);
 *   3. build this Next.js site (shop, /admin and /api/v1).
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const api = fileURLToPath(new URL("../../api", import.meta.url));
const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: "inherit", ...opts, env: { ...process.env, ...opts.env } });

run("pnpm exec prisma generate", { cwd: api });
run("pnpm exec tsup", { cwd: api });

// Only production deploys change the database: a preview of an unmerged branch
// must never migrate or seed the live store. (Set MIGRATE_ON_PREVIEW=true for
// previews that have their own database, e.g. Neon preview branches.)
const isProduction =
  process.env.VERCEL_ENV === "production" || process.env.MIGRATE_ON_PREVIEW === "true";

if (!isProduction) {
  console.log(`Skipping migrations and seed (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
} else {
  if (!process.env.DATABASE_URL) {
    console.error(
      "\nDATABASE_URL is not set. Connect a database to this Vercel project (Storage → Neon) and redeploy.\n",
    );
    process.exit(1);
  }
  if (!process.env.JWT_ACCESS_SECRET) {
    console.error(
      "\nJWT_ACCESS_SECRET is not set. Add it in Settings → Environment Variables (any random text of 32+ characters) and redeploy.\n",
    );
    process.exit(1);
  }

  // Migrations need a direct connection (PgBouncer can't hold the migration lock).
  // The Neon integration on Vercel sets DATABASE_URL_UNPOOLED for this.
  const direct =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  run("pnpm exec prisma migrate deploy", { cwd: api, env: { DATABASE_URL: direct } });

  if (process.env.SEED_ADMIN_PASSWORD) {
    run("pnpm exec tsx prisma/seed.ts", {
      cwd: api,
      env: { DATABASE_URL: direct, NODE_ENV: "production" },
    });
  } else {
    console.warn("SEED_ADMIN_PASSWORD is not set: skipping the seed (no admin account created).");
  }
}

run("pnpm exec next build");
