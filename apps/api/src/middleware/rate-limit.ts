import { ErrorCode } from "@hoodie/types";
import type { RequestHandler } from "express";
import { rateLimit, type Options } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { env } from "../config/env";
import { redis } from "../lib/redis";
import { AppError } from "../utils/app-error";

const MINUTE = 60 * 1000;

/** Limits per PLAN.md §12. `limit` requests per `windowMs`, per client IP. */
export const RATE_LIMITS = {
  global: { windowMs: MINUTE, limit: 300 },
  login: { windowMs: MINUTE, limit: 5 },
  register: { windowMs: 60 * MINUTE, limit: 10 },
  passwordReset: { windowMs: 15 * MINUTE, limit: 5 },
  emailVerification: { windowMs: 15 * MINUTE, limit: 10 },
  /** Placing orders. */
  checkout: { windowMs: MINUTE, limit: 10 },
  /** Contact form, newsletter, stock alerts, order tracking, demo payments. */
  forms: { windowMs: 15 * MINUTE, limit: 10 },
} satisfies Record<string, Pick<Options, "windowMs" | "limit">>;

export type LimiterName = keyof typeof RATE_LIMITS;
export type RateLimiters = Record<LimiterName, RequestHandler>;

export interface RateLimitOptions {
  enabled?: boolean;
  /** Override limits (used by tests). */
  overrides?: Partial<Record<LimiterName, Partial<Pick<Options, "windowMs" | "limit">>>>;
}

const passthrough: RequestHandler = (_req, _res, next) => next();

/** Builds one limiter per name. Uses Redis when configured, otherwise in-memory. */
export function createRateLimiters({
  enabled = env.RATE_LIMIT_ENABLED,
  overrides = {},
}: RateLimitOptions = {}): RateLimiters {
  const entries = (Object.keys(RATE_LIMITS) as LimiterName[]).map((name) => {
    if (!enabled) return [name, passthrough] as const;
    const limiter = rateLimit({
      ...RATE_LIMITS[name],
      ...overrides[name],
      standardHeaders: "draft-8",
      legacyHeaders: false,
      // The site's own server-side rendering (see internal-request.ts).
      skip: (_req, res) => res.locals.trustedServer === true,
      // Fail open: a Redis outage must not take the store offline.
      passOnStoreError: true,
      store: redis
        ? new RedisStore({
            prefix: `rl:${name}:`,
            sendCommand: (command: string, ...args: string[]) =>
              redis!.call(command, ...args) as Promise<RedisReply>,
          })
        : undefined,
      handler: (_req, _res, next) =>
        next(new AppError(ErrorCode.RATE_LIMITED, "Too many requests, please try again later")),
    });
    return [name, limiter] as const;
  });
  return Object.fromEntries(entries) as RateLimiters;
}

/** Route-level middleware that applies the app's limiter called `name`. */
export const limit =
  (name: LimiterName): RequestHandler =>
  (req, res, next) => {
    const limiters = req.app.locals.rateLimiters as RateLimiters | undefined;
    return limiters ? limiters[name](req, res, next) : next();
  };
