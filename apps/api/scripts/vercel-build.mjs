/**
 * Build step for the API's Vercel project (`buildCommand` in vercel.json):
 *   1. generate the Prisma client and bundle the API (dist/vercel.js);
 *   2. apply database migrations (over the direct, unpooled connection);
 *   3. seed the essentials: admin account, settings, shipping, pages and, on
 *      the very first deploy, the Urban Store catalogue.
 */
import { execSync } from "node:child_process";

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

run("pnpm exec prisma generate");
run("pnpm exec tsup");

// Migrations need a direct connection (PgBouncer can't hold the migration lock).
// The Neon integration on Vercel sets DATABASE_URL_UNPOOLED for this.
const direct =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!direct) {
  console.error("DATABASE_URL is not set: connect a database (e.g. Neon) to this Vercel project.");
  process.exit(1);
}
run("pnpm exec prisma migrate deploy", { DATABASE_URL: direct });

if (process.env.SEED_ADMIN_PASSWORD) {
  run("pnpm exec tsx prisma/seed.ts", { DATABASE_URL: direct, NODE_ENV: "production" });
} else {
  console.warn("SEED_ADMIN_PASSWORD is not set: skipping the seed (no admin account created).");
}
