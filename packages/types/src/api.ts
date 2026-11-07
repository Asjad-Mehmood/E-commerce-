/** Standard success envelope for single resources. */
export interface ApiResponse<T> {
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Standard success envelope for lists. */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Machine-readable error codes returned by the API. Extend as modules are added. */
export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  ACCOUNT_BLOCKED: "ACCOUNT_BLOCKED",
  INVALID_TOKEN: "INVALID_TOKEN",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Standard error envelope. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface HealthStatus {
  status: "ok" | "degraded";
  uptime: number;
  timestamp: string;
  version: string;
  checks: {
    database: "up" | "down";
    /** "disabled" when REDIS_URL is not configured (in-memory rate limiting is used). */
    redis: "up" | "down" | "disabled";
  };
}
