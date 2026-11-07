import { startWorker } from "./jobs";
import { queue } from "./jobs/queue";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

/**
 * Standalone background worker, for running jobs on their own server(s):
 * set RUN_WORKER=false on the API servers and run `node dist/worker.js`.
 */
const stop = await startWorker();

async function shutdown(signal: string) {
  logger.info(`${signal} received, stopping the worker…`);
  await stop();
  await Promise.allSettled([queue?.close(), prisma.$disconnect(), redis?.quit()]);
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
