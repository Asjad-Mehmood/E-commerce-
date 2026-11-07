/**
 * Vercel build for the whole store (vercel.json `buildCommand`), run from
 * apps/storefront:
 *   1. build the API package (Prisma client + apps/api/dist);
 *   2. apply database migrations over the direct (unpooled) connection;
 *   3. seed the essentials: admin account, settings, shipping, pages and, on
 *      the very first deploy, the Urban Store catalogue;
 *   4. build this Next.js site (shop, /admin and /api/v1).
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const api = fileURLToPath(new URL("../../api", import.meta.url));
const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: "inherit", ...opts, env: { ...process.env, ...opts.env } });

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

run("pnpm exec prisma generate", { cwd: api });
run("pnpm exec tsup", { cwd: api });

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

run("pnpm exec next build");
