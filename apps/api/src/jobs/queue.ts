import { Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { env, isTest } from "../config/env";
import { logger } from "../lib/logger";
import type { Mail } from "../lib/mailer";

/** Every background job, with its payload. */
export interface JobData {
  email: Mail;
  "expire-orders": Record<string, never>;
  "abandoned-carts": Record<string, never>;
  "daily-digest": Record<string, never>;
  "stock-alerts": { variantIds: string[] };
  "review-requests": Record<string, never>;
}
export type JobName = keyof JobData;

export const QUEUE_NAME = "hoodie";

/** BullMQ needs its own connections with no per-command retry limit. */
export const bullConnection = () =>
  new Redis(env.REDIS_URL!, { maxRetriesPerRequest: null, enableReadyCheck: false });

/**
 * The queue, or null when Redis is not configured, in tests, and when the API
 * runs inside the site (embedded.ts, e.g. on Vercel: no long-running worker
 * there): jobs then run inline, and scheduled jobs run from the daily cron
 * request (GET /api/v1/cron/daily).
 */
export const queue: Queue | null =
  env.REDIS_URL && !isTest && !process.env.VERCEL && !process.env.API_EMBEDDED
    ? new Queue(QUEUE_NAME, { connection: bullConnection() })
    : null;

queue?.on("error", (err) => logger.warn({ err: err.message }, "Job queue error"));

const DEFAULTS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

/** Runs a job now, in this process (no Redis, or the queue is unreachable). */
export async function runInline<N extends JobName>(name: N, data: JobData[N]): Promise<void> {
  const { handlers } = await import("./handlers");
  await (handlers[name] as (d: JobData[N]) => Promise<unknown>)(data);
}

/**
 * Adds a background job. With Redis it is queued (retried with backoff on
 * failure, survives restarts); without Redis it runs straight away in this
 * process. Delayed jobs need Redis: without it they are skipped (logged).
 */
export async function enqueue<N extends JobName>(
  name: N,
  data: JobData[N],
  opts: JobsOptions = {},
): Promise<void> {
  if (!queue) {
    if (opts.delay) {
      logger.debug({ name }, "Delayed job skipped: no Redis queue configured");
      return;
    }
    await runInline(name, data);
    return;
  }
  await queue.add(name, data, { ...DEFAULTS, ...opts });
}
