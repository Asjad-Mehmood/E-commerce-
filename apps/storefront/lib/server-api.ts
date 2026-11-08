import type { ApiResponse, PaginatedResponse } from "@hoodie/types";
import { unstable_cache } from "next/cache";
import { connection } from "next/server";

interface FetchOptions {
  /** Seconds to cache the API response. */
  revalidate?: number;
}

/** Reads from the API in this process (no HTTP round trip). 404 → null. */
async function load(path: string): Promise<string | null> {
  const { request } = await import("@hoodie/api/embedded");
  const res = await request(path);
  if (res.status === 404) return null;
  if (res.status >= 400) throw new Error(`API ${res.status} for GET ${path}`);
  return res.body;
}

/**
 * Server-side GET to the public API.
 *
 * `connection()` makes the calling page render at request time (so the build
 * never needs the database), while responses are cached for `revalidate`
 * seconds so pages stay fast. Errors are never cached.
 */
async function get<T>(path: string, { revalidate = 60 }: FetchOptions = {}): Promise<T | null> {
  await connection();
  const body = await unstable_cache(load, ["api-get", String(revalidate)], { revalidate })(path);
  return body === null ? null : (JSON.parse(body) as T);
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
