import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { env } from "./config/env";
import { docsRouter } from "./docs/docs.routes";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { originCheck } from "./middleware/origin-check";
import { createRateLimiters, type RateLimitOptions } from "./middleware/rate-limit";
import { MAX_UPLOAD_BYTES } from "./modules/admin/uploads.routes";
import { apiRouter } from "./routes";

export interface CreateAppOptions {
  /** Extra routers to mount under /api/v1 (used by tests). */
  extend?: (router: express.Router) => void;
  rateLimit?: RateLimitOptions;
}

export function createApp({ extend, rateLimit }: CreateAppOptions = {}): Express {
  const app = express();
  const limiters = createRateLimiters(rateLimit);
  app.locals.rateLimiters = limiters;

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers["x-request-id"];
        const id = typeof existing === "string" && existing ? existing : randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.startsWith("/api/v1/health") ?? false },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(compression());
  app.use(
    express.json({
      limit: "1mb",
      // Keep the exact bytes: Stripe webhook signatures are computed over the raw body.
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));
  // Admin image uploads (POST /admin/uploads/media) send raw image bytes.
  app.use(express.raw({ type: "image/*", limit: MAX_UPLOAD_BYTES }));
  app.use(cookieParser());

  if (env.API_DOCS_ENABLED) app.use("/api/docs", docsRouter());

  const v1 = express.Router();
  v1.use(limiters.global);
  v1.use(originCheck(env.CORS_ORIGINS));
  v1.use(apiRouter);
  extend?.(v1);
  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
