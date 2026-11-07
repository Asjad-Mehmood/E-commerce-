import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection for cookie-based auth (PLAN.md §12).
 *
 * Browsers always send an `Origin` header on cross-origin writes. Together with
 * SameSite=Lax cookies, rejecting writes from origins outside the allowlist
 * blocks cross-site request forgery. Requests without an Origin header (curl,
 * server-to-server, mobile apps) carry no ambient browser cookies, so they are allowed.
 */
export const originCheck =
  (allowedOrigins: string[]): RequestHandler =>
  (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin;
    if (!origin) return next();

    const self = `${req.protocol}://${req.get("host")}`; // e.g. Swagger UI served by the API
    if (origin === self || allowedOrigins.includes(origin)) return next();

    next(AppError.forbidden("Request origin not allowed"));
  };
