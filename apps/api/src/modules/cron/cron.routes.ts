import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";
import { ok } from "../../lib/http";
import { logger } from "../../lib/logger";
import { defineRoutes, route } from "../../lib/route";
import { AppError } from "../../utils/app-error";
import { sendCartReminders } from "../engagement/abandoned-carts";
import { sendDailyDigest } from "../engagement/digest";
import { expireUnpaidOrders } from "../orders/lifecycle";
import { sendDueReviewRequests } from "../reviews/review-request";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** The scheduled jobs, run one after another; one failing doesn't stop the others. */
const DAILY_JOBS = {
  expireOrders: () => expireUnpaidOrders(),
  cartReminders: () => sendCartReminders(),
  reviewRequests: () => sendDueReviewRequests(),
  dailyDigest: () => sendDailyDigest(),
} satisfies Record<string, () => Promise<unknown>>;

/**
 * Serverless hosts have no always-on worker, so Vercel calls this once a day
 * (see apps/api/vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET the endpoint doesn't exist.
 */
export const cronRouter = defineRoutes("/cron", "System", [
  route({
    method: "get",
    path: "/daily",
    summary: "Runs the daily jobs (called by Vercel Cron with the CRON_SECRET)",
    access: "public",
    handler: async ({ req }) => {
      if (!env.CRON_SECRET) throw AppError.notFound();
      const given = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      if (!timingSafeEqual(digest(given), digest(env.CRON_SECRET))) throw AppError.unauthorized();

      const results: Record<string, unknown> = {};
      for (const [name, run] of Object.entries(DAILY_JOBS)) {
        try {
          results[name] = await run();
        } catch (err) {
          logger.error({ err, job: name }, "Daily job failed");
          results[name] = "failed";
        }
      }
      logger.info({ results }, "Daily jobs finished");
      return ok(results);
    },
  }),
]);
