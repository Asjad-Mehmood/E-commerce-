import type { ApiResponse, PaginatedResponse } from "@hoodie/types";
import { connection } from "next/server";
import { serverApiUrl } from "./config";

interface FetchOptions {
  /** Seconds to cache the API response in Next's data cache. */
  revalidate?: number;
  tags?: string[];
}

/**
 * Server-side GET to the public API.
 *
 * `connection()` makes the calling page render at request time (so the build
 * never needs a running API), while `revalidate` still caches API responses
 * for a short time so pages stay fast.
 */
async function get<T>(
  path: string,
  { revalidate = 60, tags }: FetchOptions = {},
): Promise<T | null> {
  await connection();
  const res = await fetch(`${serverApiUrl}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate, tags },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for GET ${path}`);
  return (await res.json()) as T;
}

/** `data` of a single-resource response, or null on 404. */
export async function getData<T>(path: string, opts?: FetchOptions): Promise<T | null> {
  return (await get<ApiResponse<T>>(path, opts))?.data ?? null;
}

/** A paginated list response. */
export async function getList<T>(path: string, opts?: FetchOptions): Promise<PaginatedResponse<T>> {
  const res = await get<PaginatedResponse<T>>(path, opts);
  if (!res) throw new Error(`API 404 for GET ${path}`);
  return res;
}

/** Like getData but never throws: for non-essential data such as navigation. */
export async function getDataSafe<T>(path: string, fallback: T, opts?: FetchOptions): Promise<T> {
  try {
    return (await getData<T>(path, opts)) ?? fallback;
  } catch {
    return fallback;
  }
}
