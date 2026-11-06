import { hasRole, Role } from "@hoodie/types";

export interface NavItem {
  label: string;
  href: string;
  /** Minimum role that can see this item. */
  minRole: Role;
  /** Roadmap phase that builds this module. Items with phase > 0 render as "Soon". */
  phase: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const { SUPPORT, MANAGER, SUPER_ADMIN } = Role;

/** Every admin module from PLAN.md §7.2, grouped for the sidebar. */
export const adminNav: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", minRole: SUPPORT, phase: 0 },
      { label: "Reports", href: "/reports", minRole: MANAGER, phase: 4 },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Orders", href: "/orders", minRole: SUPPORT, phase: 4 },
      { label: "Returns", href: "/returns", minRole: SUPPORT, phase: 5 },
      { label: "Customers", href: "/customers", minRole: SUPPORT, phase: 4 },
      { label: "Messages", href: "/messages", minRole: SUPPORT, phase: 4 },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/products", minRole: MANAGER, phase: 4 },
      { label: "Inventory", href: "/inventory", minRole: MANAGER, phase: 4 },
      { label: "Categories", href: "/categories", minRole: MANAGER, phase: 4 },
      { label: "Collections", href: "/collections", minRole: MANAGER, phase: 4 },
      { label: "Reviews", href: "/reviews", minRole: SUPPORT, phase: 5 },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Coupons", href: "/coupons", minRole: MANAGER, phase: 4 },
      { label: "Content", href: "/content", minRole: MANAGER, phase: 4 },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Shipping", href: "/settings/shipping", minRole: MANAGER, phase: 4 },
      { label: "Staff", href: "/staff", minRole: SUPER_ADMIN, phase: 4 },
      { label: "Store settings", href: "/settings", minRole: SUPER_ADMIN, phase: 4 },
      { label: "Audit log", href: "/audit-log", minRole: SUPER_ADMIN, phase: 4 },
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
