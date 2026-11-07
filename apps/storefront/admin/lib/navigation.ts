/**
 * next/navigation for admin pages. Paths are relative to the panel: the router
 * adds the /admin prefix and usePathname() leaves it out, so admin code reads
 * and writes "/orders" while the browser shows "/admin/orders".
 */
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { useMemo } from "react";
import { adminHref, panelPath } from "./paths";

export * from "next/navigation";

export function usePathname(): string {
  return panelPath(useNextPathname());
}

export function useRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href, options) => router.push(adminHref(href), options),
      replace: (href, options) => router.replace(adminHref(href), options),
      prefetch: (href, options) => router.prefetch(adminHref(href), options),
    }),
    [router],
  );
}
