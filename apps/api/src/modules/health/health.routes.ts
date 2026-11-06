import type { ApiResponse, HealthStatus } from "@hoodie/types";
import { Router } from "express";
import { prisma } from "../../lib/prisma";

const startedAt = Date.now();

export const healthRouter = Router();

/** Liveness + readiness probe used by uptime monitors and the admin dashboard. */
healthRouter.get("/", async (_req, res) => {
  let database: HealthStatus["checks"]["database"] = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  const body: ApiResponse<HealthStatus> = {
    data: {
      status: database === "up" ? "ok" : "degraded",
      uptime: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
      checks: { database },
    },
  };

  res.status(database === "up" ? 200 : 503).json(body);
});
