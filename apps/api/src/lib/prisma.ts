import { PrismaClient } from "@prisma/client";
import { isProd } from "../config/env";

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query errors are reported by the error handler; logging them here too would duplicate them.
    log: ["warn"],
  });

if (!isProd) globalForPrisma.prisma = prisma;
