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
}

type Init = RequestInit & {
  /** Next.js fetch cache options, e.g. `{ revalidate: 60, tags: ["products"] }`. */
  next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * Typed fetch wrapper for the backend API.
 * Sends cookies (auth, guest cart) and JSON by default.
 */
export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const res = await fetch(`${siteConfig.apiUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      body?.error.code ?? "INTERNAL_ERROR",
      body?.error.message ?? res.statusText,
      body?.error.details,
    );
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
}
