/**
 * Domain enums shared by the API and both frontends.
 *
 * These MUST stay in sync with the enums in `apps/api/prisma/schema.prisma`.
 * A test in the API (`enums.test.ts`) fails if they drift apart.
 */

const values = <T extends Record<string, string>>(obj: T) =>
  Object.values(obj) as [T[keyof T], ...T[keyof T][]];

export const Role = {
  CUSTOMER: "CUSTOMER",
  SUPPORT: "SUPPORT",
  MANAGER: "MANAGER",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = values(Role);

/** Admin roles in ascending order of privilege. */
export const ADMIN_ROLES = [Role.SUPPORT, Role.MANAGER, Role.SUPER_ADMIN] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Privilege rank of each role. Higher includes everything lower can do. */
export const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 0,
  SUPPORT: 1,
  MANAGER: 2,
  SUPER_ADMIN: 3,
};

/** True if `role` is at least as privileged as `minRole`. */
export function hasRole(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/** True for any staff role (Support, Manager, Super Admin). */
export function isAdminRole(role: Role): role is AdminRole {
  return hasRole(role, Role.SUPPORT);
}

export const ProductStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];
export const PRODUCT_STATUSES = values(ProductStatus);

export const Fit = {
  REGULAR: "REGULAR",
  OVERSIZED: "OVERSIZED",
  SLIM: "SLIM",
} as const;
export type Fit = (typeof Fit)[keyof typeof Fit];
export const FITS = values(Fit);

export const OrderStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  CONFIRMED: "CONFIRMED",
  PAID: "PAID",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURNED: "RETURNED",
  REFUNDED: "REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const ORDER_STATUSES = values(OrderStatus);

/** Customer-facing order status labels. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  PAID: "Paid",
  PROCESSING: "Being prepared",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

export const PaymentMethod = {
  STRIPE: "STRIPE",
  COD: "COD",
  JAZZCASH: "JAZZCASH",
  EASYPAISA: "EASYPAISA",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export const PAYMENT_METHODS = values(PaymentMethod);

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const PAYMENT_STATUSES = values(PaymentStatus);

export const DiscountType = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
  FREE_SHIPPING: "FREE_SHIPPING",
} as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];
export const DISCOUNT_TYPES = values(DiscountType);

export const ReturnStatus = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RECEIVED: "RECEIVED",
  REFUNDED: "REFUNDED",
} as const;
export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];
export const RETURN_STATUSES = values(ReturnStatus);

export const MessageStatus = {
  NEW: "NEW",
  READ: "READ",
  REPLIED: "REPLIED",
  ARCHIVED: "ARCHIVED",
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];
export const MESSAGE_STATUSES = values(MessageStatus);
