import type { ApiErrorBody } from "@hoodie/types";
import { adminConfig } from "./config";

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
  refreshing ??= fetch(`${adminConfig.apiUrl}/auth/refresh`, {
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
  body?: Json | Blob;
}

const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/reset-password"];

async function request(path: string, { body, ...init }: Options, retried: boolean) {
  const isBlob = body instanceof Blob;
  const res = await fetch(`${adminConfig.apiUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(body && !isBlob ? { "Content-Type": "application/json" } : {}),
      ...(isBlob ? { "Content-Type": body.type } : {}),
      ...init.headers,
    },
    body: isBlob ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return res;

  const json = (await res.json().catch(() => null)) as ApiErrorBody | null;
  const error = new ApiError(
    res.status,
    json?.error?.code ?? "INTERNAL_ERROR",
    json?.error?.message ??
      (res.status === 413 ? "The file is too large" : "Something went wrong. Please try again."),
    json?.error?.details,
  );
  const reason = (error.details as { reason?: string } | undefined)?.reason;
  // Expired access token: refresh once and retry.
  if (
    res.status === 401 &&
    !retried &&
    !NO_REFRESH.includes(path) &&
    reason === "TOKEN_EXPIRED" &&
    (await refreshSession())
  ) {
    return request(path, { body, ...init }, true);
  }
  throw error;
}

/**
 * Browser API client. Sends cookies, encodes JSON, and transparently refreshes
 * the session once when the access token has expired, then retries.
 */
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const res = await request(path, options, false);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Downloads a file (PDF, CSV) through the API with the admin's session, then
 * saves it (`download`) or opens it in a new tab (`open`).
 */
export async function downloadFile(path: string, mode: "download" | "open" = "download") {
  // Open the tab first: browsers block window.open after an await.
  const tab = mode === "open" ? window.open("", "_blank") : null;
  try {
    const res = await request(path, { headers: { Accept: "*/*" } }, false);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "");
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] ?? "download";
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/** A message to show for any error thrown by `api()`. */
export const errorMessage = (err: unknown) =>
  err instanceof ApiError
    ? err.message
    : "Something went wrong. Check your connection and try again.";
