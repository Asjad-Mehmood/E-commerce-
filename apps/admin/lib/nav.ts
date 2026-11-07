import { hasRole, Role } from "@hoodie/types";

export interface NavItem {
  label: string;
  href: string;
  /** Minimum role that can see this item. */
  minRole: Role;
  /** Roadmap phase that builds this module. Items after BUILT_PHASE render as "Soon". */
  phase: number;
  /** Key of the notification count shown next to the item. */
  badge?: "toFulfil" | "newMessages" | "lowStock" | "pendingReturns" | "pendingReviews";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const { SUPPORT, MANAGER, SUPER_ADMIN } = Role;

/** Modules up to this roadmap phase are built. */
export const BUILT_PHASE = 5;

/** Every admin module from PLAN.md §7.2, grouped for the sidebar. */
export const adminNav: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", minRole: SUPPORT, phase: 4 },
      { label: "Reports", href: "/reports", minRole: MANAGER, phase: 4 },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Orders", href: "/orders", minRole: SUPPORT, phase: 4, badge: "toFulfil" },
      { label: "Returns", href: "/returns", minRole: SUPPORT, phase: 5, badge: "pendingReturns" },
      { label: "Customers", href: "/customers", minRole: SUPPORT, phase: 4 },
      { label: "Messages", href: "/messages", minRole: SUPPORT, phase: 4, badge: "newMessages" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/products", minRole: MANAGER, phase: 4 },
      { label: "Inventory", href: "/inventory", minRole: MANAGER, phase: 4, badge: "lowStock" },
      { label: "Categories", href: "/categories", minRole: MANAGER, phase: 4 },
      { label: "Collections", href: "/collections", minRole: MANAGER, phase: 4 },
      { label: "Reviews", href: "/reviews", minRole: SUPPORT, phase: 5, badge: "pendingReviews" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Coupons", href: "/coupons", minRole: MANAGER, phase: 4 },
      { label: "Content", href: "/content", minRole: MANAGER, phase: 4 },
      { label: "Newsletter", href: "/newsletter", minRole: MANAGER, phase: 5 },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Shipping", href: "/settings/shipping", minRole: MANAGER, phase: 4 },
      { label: "Staff", href: "/staff", minRole: SUPER_ADMIN, phase: 4 },
      { label: "Store settings", href: "/settings", minRole: SUPER_ADMIN, phase: 4 },
      { label: "Activity log", href: "/audit-log", minRole: SUPER_ADMIN, phase: 4 },
    ],
  },
];

/** Same rule the API enforces (shared from @hoodie/types). */
export const canAccess = hasRole;

/** Sidebar sections filtered to what `role` may see (empty sections removed). */
export function navForRole(role: Role): NavSection[] {
  return adminNav
    .map((s) => ({ ...s, items: s.items.filter((i) => canAccess(role, i.minRole)) }))
    .filter((s) => s.items.length > 0);
}

/** The nav item for a path: the longest matching href wins, so /settings/shipping ≠ /settings. */
export function activeItem(pathname: string): NavItem | undefined {
  return adminNav
    .flatMap((s) => s.items)
    .filter((i) =>
      i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Minimum role for a path (used to show "no access" on direct visits). */
export const minRoleFor = (pathname: string): Role => activeItem(pathname)?.minRole ?? SUPPORT;
