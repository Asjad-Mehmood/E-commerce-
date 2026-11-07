import { Prisma } from "@prisma/client";
import { ErrorCode, type ApiErrorBody } from "@hoodie/types";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";
import { isProd } from "../config/env";
import { AppError } from "../utils/app-error";

/** 404 for any route that did not match. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(ErrorCode.NOT_FOUND, `Route ${req.method} ${req.path} not found`));
};

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(ErrorCode.VALIDATION_ERROR, "Validation failed", z.flattenError(err));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return AppError.conflict("A record with these details already exists", {
        fields: err.meta?.target,
      });
    }
    if (err.code === "P2025") return AppError.notFound();
  }

  // Body larger than the parser limit (body-parser sets status 413 and type).
  if (
    typeof err === "object" &&
    err !== null &&
    (err as { type?: string }).type === "entity.too.large"
  ) {
    return new AppError(ErrorCode.BAD_REQUEST, "The upload is too large", undefined, 413);
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && "body" in err) {
    return AppError.badRequest("Malformed JSON body");
  }

  return new AppError(ErrorCode.INTERNAL_ERROR, "Something went wrong");
}

/** Converts every thrown error into the standard error envelope. Must be registered last. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);

  if (appError.status >= 500) {
    req.log?.error({ err }, "Unhandled error");
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      requestId: String(req.id ?? ""),
    },
  };

  // Never leak internals in production; include the stack in development to help debugging.
  if (!isProd && appError.status >= 500 && err instanceof Error) {
    body.error.details = { cause: err.message, stack: err.stack?.split("\n").slice(0, 5) };
  }

  res.status(appError.status).json(body);
};
