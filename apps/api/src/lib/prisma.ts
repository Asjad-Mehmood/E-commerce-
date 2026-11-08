import { PrismaClient } from "@prisma/client";
import { env, isProd } from "../config/env";

/**
 * Connection URL tweaks for hosted Postgres (no effect on a local database):
 * - a pooled connection (Neon "-pooler" hosts, Supabase port 6543) goes through
 *   PgBouncer, which needs `pgbouncer=true`;
 * - a serverless database may take a few seconds to wake up, so allow 15 s.
 */
export function databaseUrl(raw: string): string {
  if (!URL.canParse(raw)) return raw;
  const url = new URL(raw);
  const pooled = url.hostname.includes("-pooler.") || url.port === "6543";
  if (pooled && !url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  if (url.hostname !== "localhost" && !url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "15");
  }
  return url.toString();
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl(env.DATABASE_URL),
    // Query errors are reported by the error handler; logging them here too would duplicate them.
    log: ["warn"],
  });

if (!isProd) globalForPrisma.prisma = prisma;
