import type { RequestHandler } from "express";
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * On Vercel the storefront and admin proxy /api/v1 to this API, so every
 * request arrives from Vercel's servers. Requests carrying the shared
 * PROXY_SECRET are trusted to say who the shopper is:
 * - `x-client-ip` becomes `req.ip` (rate limits, audit log);
 * - without it, the request comes from the site's own server-side rendering
 *   and is exempt from rate limits (`res.locals.trustedServer`).
 * Anything else is treated like a direct request.
 */
export function trustedProxy(secret: string | undefined): RequestHandler {
  const expected = secret ? digest(secret) : null;
  return (req, res, next) => {
    const given = req.headers["x-proxy-secret"];
    delete req.headers["x-proxy-secret"];
    const clientIp = req.headers["x-client-ip"];
    delete req.headers["x-client-ip"];
    if (!expected || typeof given !== "string" || !timingSafeEqual(digest(given), expected)) {
      return next();
    }
    if (typeof clientIp === "string" && clientIp) {
      Object.defineProperty(req, "ip", { value: clientIp.split(",")[0]!.trim() });
    } else {
      res.locals.trustedServer = true;
    }
    next();
  };
}
