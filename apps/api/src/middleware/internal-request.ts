import type { RequestHandler } from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";

const KEY = Symbol.for("urbanstore.internalRequestToken");
const store = globalThis as unknown as Record<symbol, string | undefined>;

/**
 * A random token that exists only in this process's memory. The storefront's
 * server-side rendering calls the API in-process (see embedded.ts) with it,
 * so those calls skip the per-IP rate limits. Nothing outside the process can
 * know it.
 */
export const internalRequestToken = (): string => (store[KEY] ??= randomUUID());

export const INTERNAL_HEADER = "x-internal-request";

export const internalRequest: RequestHandler = (req, res, next) => {
  const given = req.headers[INTERNAL_HEADER];
  delete req.headers[INTERNAL_HEADER];
  if (typeof given === "string" && given.length === internalRequestToken().length) {
    if (timingSafeEqual(Buffer.from(given), Buffer.from(internalRequestToken()))) {
      res.locals.trustedServer = true;
    }
  }
  next();
};
