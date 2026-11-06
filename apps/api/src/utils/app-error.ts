import { ErrorCode } from "@hoodie/types";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * An expected, client-facing error. Throw it from services/controllers and the
 * error handler turns it into the standard `{ error: { code, message } }` body.
 */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status ?? STATUS_BY_CODE[code];
  }

  static notFound(what = "Resource") {
    return new AppError(ErrorCode.NOT_FOUND, `${what} not found`);
  }
  static badRequest(message: string, details?: unknown) {
    return new AppError(ErrorCode.BAD_REQUEST, message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(ErrorCode.UNAUTHORIZED, message);
  }
  static forbidden(message = "You do not have permission to do this") {
    return new AppError(ErrorCode.FORBIDDEN, message);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(ErrorCode.CONFLICT, message, details);
  }
}
