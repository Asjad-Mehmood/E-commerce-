import type { RequestHandler } from "express";
import type { z } from "zod";

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augments its types via this global namespace
  namespace Express {
    interface Request {
      /** Parsed + coerced query string (set by `validate({ query })`). */
      validatedQuery?: unknown;
    }
  }
}

/**
 * Validate and coerce the request with Zod. Failures throw a ZodError, which the
 * error handler turns into a 422 VALIDATION_ERROR response.
 *
 * Note: Express 5 makes `req.query` read-only, so the parsed query is exposed as
 * `req.validatedQuery`.
 */
export const validate =
  ({ body, query, params }: Schemas): RequestHandler =>
  (req, _res, next) => {
    if (body) req.body = body.parse(req.body);
    if (params) req.params = params.parse(req.params) as typeof req.params;
    if (query) req.validatedQuery = query.parse(req.query);
    next();
  };
