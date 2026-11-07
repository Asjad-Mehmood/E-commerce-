import type { Role } from "@hoodie/types";
import { Router, type Request, type RequestHandler, type Response } from "express";
import type { z } from "zod";
import { authenticate, authorize, optionalAuth } from "../middleware/auth";
import { limit, type LimiterName } from "../middleware/rate-limit";

type Method = "get" | "post" | "put" | "patch" | "delete";

/**
 * - `public`: anyone
 * - `optional`: guests and signed-in users (req.user set when signed in)
 * - `user`: any signed-in user
 * - a staff role: that role or higher
 */
export type Access = "public" | "optional" | "user" | Exclude<Role, "CUSTOMER">;

type Infer<T> = T extends z.ZodType ? z.output<T> : undefined;

export interface HandlerContext<B, Q> {
  req: Request;
  res: Response;
  body: Infer<B>;
  query: Infer<Q>;
  params: Record<string, string>;
}

export interface RouteDef<
  B extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
> {
  method: Method;
  path: string;
  summary: string;
  description?: string;
  access: Access;
  body?: B;
  query?: Q;
  rateLimit?: LimiterName;
  /** Status for a successful response (default 200, or 204 when the handler returns nothing). */
  status?: number;
  /**
   * Returns the JSON response body (usually `ok(data)` or `paginated(...)`), or
   * `undefined` for 204 No Content.
   */
  handler: (ctx: HandlerContext<B, Q>) => unknown | Promise<unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry
export type AnyRouteDef = RouteDef<any, any>;

export interface RegisteredRoute extends AnyRouteDef {
  /** Full path, e.g. /api/v1/products/:slug */
  fullPath: string;
  tag: string;
}

/** Every route mounted through `defineRoutes`; the OpenAPI spec is generated from this. */
export const routeRegistry: RegisteredRoute[] = [];

/** Type helper so `body`/`query` types flow into the handler. */
export function route<
  B extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
>(def: RouteDef<B, Q>): AnyRouteDef {
  return def;
}

function accessMiddleware(access: Access): RequestHandler[] {
  switch (access) {
    case "public":
      return [];
    case "optional":
      return [optionalAuth];
    case "user":
      return [authenticate];
    default:
      return [authenticate, authorize(access)];
  }
}

/**
 * Builds an Express router from route definitions and records each one in the
 * registry for the API docs. Validation, auth and rate limiting are applied
 * declaratively, so every route behaves (and is documented) consistently.
 */
export function defineRoutes(basePath: string, tag: string, defs: AnyRouteDef[]): Router {
  const router = Router();

  for (const def of defs) {
    routeRegistry.push({ ...def, tag, fullPath: `/api/v1${basePath}${def.path}` });

    const middleware: RequestHandler[] = [
      ...(def.rateLimit ? [limit(def.rateLimit)] : []),
      ...accessMiddleware(def.access),
    ];

    router[def.method](def.path, ...middleware, async (req, res) => {
      const body = def.body ? def.body.parse(req.body) : undefined;
      const query = def.query ? def.query.parse(req.query) : undefined;
      const result = await def.handler({
        req,
        res,
        body,
        query,
        params: req.params as Record<string, string>,
      });

      if (res.headersSent) return;
      if (result === undefined) {
        res.status(def.status ?? 204).end();
      } else {
        res.status(def.status ?? 200).json(result);
      }
    });
  }

  return router;
}
