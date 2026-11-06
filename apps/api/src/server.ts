import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 API ready at http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  if (env.API_DOCS_ENABLED) logger.info(`📚 API docs at http://localhost:${env.PORT}/api/docs`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down…`);
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), redis?.quit()]);
    process.exit(0);
  });
  // Force exit if connections do not close in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
