import type { ApiErrorBody } from "@hoodie/types";
import { siteConfig } from "./config";

/** Error thrown for any non-2xx API response, carrying the API's error code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field errors from a 422 VALIDATION_ERROR response. */
  get fieldErrors(): Record<string, string[] | undefined> {
    const d = this.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return d?.fieldErrors ?? {};
  }
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, however many requests hit an expired token together. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${siteConfig.apiUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Json = Record<string, unknown> | unknown[];

interface Options extends Omit<RequestInit, "body"> {
  body?: Json;
}

const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

/**
 * Browser API client. Sends cookies, encodes JSON, and transparently refreshes
 * the session once when the access token has expired, then retries.
 */
export async function api<T>(
  path: string,
  { body, ...init }: Options = {},
  retried = false,
): Promise<T> {
  const res = await fetch(`${siteConfig.apiUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (ApiErrorBody & { data?: unknown }) | null;

  if (!res.ok) {
    const error = new ApiError(
      res.status,
      json?.error?.code ?? "INTERNAL_ERROR",
      json?.error?.message ?? "Something went wrong. Please try again.",
      json?.error?.details,
    );
    const reason = (error.details as { reason?: string } | undefined)?.reason;
    // Expired token → refresh once and retry.
    const shouldRefresh =
      res.status === 401 && !retried && !NO_REFRESH.includes(path) && reason === "TOKEN_EXPIRED";
    if (shouldRefresh && (await refreshSession())) {
      return api<T>(path, { body, ...init }, true);
    }
    throw error;
  }

  return json as T;
}
