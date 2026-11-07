import { Worker } from "bullmq";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { storeTimeZone } from "../lib/settings";
import { bullConnection, queue, QUEUE_NAME, runInline, type JobName } from "./queue";

const MINUTE = 60_000;

/** Recurring jobs: name → how often. */
const SCHEDULES = (timeZone: string) => [
  { name: "expire-orders" as const, repeat: { every: MINUTE } },
  { name: "abandoned-carts" as const, repeat: { every: 15 * MINUTE } },
  // 08:00 in the store's time zone.
  { name: "daily-digest" as const, repeat: { pattern: "0 8 * * *", tz: timeZone } },
];

/** Starts the BullMQ worker that processes queued and scheduled jobs. */
export async function startWorker(): Promise<() => Promise<void>> {
  if (!queue) throw new Error("startWorker needs REDIS_URL");
  for (const s of SCHEDULES(await storeTimeZone())) {
    await queue.upsertJobScheduler(s.name, s.repeat, { name: s.name, data: {} });
  }
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { handlers } = await import("./handlers");
      const result = await (handlers[job.name as JobName] as (d: unknown) => Promise<unknown>)(
        job.data,
      );
      return typeof result === "number" ? { count: result } : undefined;
    },
    { connection: bullConnection(), concurrency: 5 },
  );
  worker.on("failed", (job, err) =>
    logger.error(
      { err: err.message, job: job?.name, attempt: job?.attemptsMade },
      "Background job failed",
    ),
  );
  worker.on("error", (err) => logger.warn({ err: err.message }, "Worker error"));
  logger.info("Background job worker started");
  return async () => {
    await worker.close();
  };
}

/**
 * Starts background work for this process:
 * - with Redis: the BullMQ worker (unless RUN_WORKER=false, for a separate worker process);
 * - without Redis: simple in-process timers for the recurring jobs (no daily digest).
 */
export async function startJobs(): Promise<() => Promise<void>> {
  if (queue) {
    if (!env.RUN_WORKER) return async () => {};
    return startWorker();
  }

  const every = (name: JobName, ms: number) => {
    const run = () =>
      runInline(name, {} as never).catch((err) => logger.error({ err, name }, "Job failed"));
    void run();
    const timer = setInterval(run, ms);
    timer.unref();
    return timer;
  };
  const timers = [every("expire-orders", MINUTE), every("abandoned-carts", 15 * MINUTE)];
  logger.info("Background jobs running in-process (no REDIS_URL)");
  return async () => timers.forEach(clearInterval);
}
