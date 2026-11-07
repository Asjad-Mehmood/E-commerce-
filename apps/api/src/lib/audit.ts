import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { logger } from "./logger";
import { prisma } from "./prisma";

/**
 * Records an admin write action in the audit log (PLAN.md §12).
 * Failures are logged but never break the admin action itself.
 */
export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId: string,
  diff?: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { adminId: req.user?.id, action, entity, entityId, diff, ip: req.ip },
    });
  } catch (err) {
    logger.error({ err, action, entity, entityId }, "Failed to write audit log");
  }
}
