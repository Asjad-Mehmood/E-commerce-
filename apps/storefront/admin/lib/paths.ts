/** The admin panel lives under /admin on the same site as the shop. */
export const ADMIN_BASE = "/admin";

/**
 * Admin code uses paths relative to the panel ("/orders/US-10001"); this turns
 * them into site paths ("/admin/orders/US-10001"). Anything else (full URLs,
 * shop paths built with `shopUrl`) is left alone.
 */
export function adminHref(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith(`${ADMIN_BASE}/`)) {
    return path;
  }
  if (path === ADMIN_BASE) return path;
  if (path === "/") return ADMIN_BASE;
  if (path.startsWith("/?")) return `${ADMIN_BASE}${path.slice(1)}`;
  return `${ADMIN_BASE}${path}`;
}

/** The reverse: a site path ("/admin/orders") as an admin path ("/orders"). */
export function panelPath(pathname: string): string {
  if (pathname === ADMIN_BASE) return "/";
  return pathname.startsWith(`${ADMIN_BASE}/`) ? pathname.slice(ADMIN_BASE.length) : pathname;
}
