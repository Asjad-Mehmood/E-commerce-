"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * List filters kept in the URL, so they survive reloads and can be shared.
 * `set()` replaces the given keys (empty values are removed) and resets the
 * page to 1 unless the page itself is being changed.
 */
export function useUrlState<K extends string>() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const values = useMemo(() => {
    const out: Partial<Record<K | "page", string>> = {};
    params.forEach((v, k) => {
      out[k as K] = v;
    });
    return out;
  }, [params]);

  const set = useCallback(
    (patch: Partial<Record<K | "page", string | number | null | undefined>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  /** The current query string (for API calls), including only non-empty values. */
  const query = params.toString();
  return { values, set, query, page: Number(values.page ?? 1) || 1 };
}

/** `value`, but only after it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
