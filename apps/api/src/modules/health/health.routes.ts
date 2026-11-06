import type { HealthStatus } from "@hoodie/types";
import { ok } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { redisStatus } from "../../lib/redis";
import { defineRoutes, route } from "../../lib/route";

const startedAt = Date.now();

export const healthRouter = defineRoutes("/health", "System", [
  route({
    method: "get",
    path: "",
    summary: "Liveness and readiness check",
    description:
      "Returns 503 when the database is unreachable. Used by uptime monitors and the admin dashboard.",
    access: "public",
    handler: async ({ res }) => {
      let database: HealthStatus["checks"]["database"] = "up";
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        database = "down";
      }
      const redis = await redisStatus();

      res.status(database === "up" ? 200 : 503);
      return ok<HealthStatus>({
        status: database === "up" && redis !== "down" ? "ok" : "degraded",
        uptime: Math.round((Date.now() - startedAt) / 1000),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? "0.1.0",
        checks: { database, redis },
      });
    },
  }),
]);
