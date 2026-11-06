import { Redis } from "ioredis";
import { env, isTest } from "../config/env";
import { logger } from "./logger";

/**
 * Shared Redis client, or null when REDIS_URL is not set (and always in tests).
 * Used for rate limiting now and BullMQ queues from Phase 3.
 */
export const redis: Redis | null =
  env.REDIS_URL && !isTest
    ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false })
    : null;

redis?.on("error", (err) => logger.warn({ err: err.message }, "Redis error"));

export async function redisStatus(): Promise<"up" | "down" | "disabled"> {
  if (!redis) return "disabled";
  try {
    return (await redis.ping()) === "PONG" ? "up" : "down";
  } catch {
    return "down";
  }
}
