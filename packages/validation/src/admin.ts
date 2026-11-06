import {
  ADMIN_ROLES,
  DISCOUNT_TYPES,
  MESSAGE_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from "@hoodie/types";
import { z } from "zod";
import { emailSchema, moneySchema, paginationSchema, slugSchema } from "./common";

/*
 * Admin (Phase 4) request schemas. As in product.ts, each resource defines its
 * fields without defaults and the create schema adds them, so a PATCH never
 * resets fields it did not send.
 */

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(item));

/** A calendar day, YYYY-MM-DD, interpreted in the store's time zone. */
export const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Invalid date");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

const dateRange = {
  from: dayString.optional(),
  to: dayString.optional(),
};
const rangeRule = (d: { from?: string; to?: string }) => !d.from || !d.to || d.from <= d.to;
const rangeError = { message: "The start date must be before the end date", path: ["to"] };

// ───────────── Dashboard & reports ─────────────

export const dashboardQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((n) => [7, 30, 90].includes(n), "Use 7, 30 or 90")
    .default(30),
});

export const REPORT_GROUPS = ["day", "week", "month"] as const;

export const reportQuerySchema = z
  .object({
    ...dateRange,
    groupBy: z.enum(REPORT_GROUPS).default("day"),
    format: z.enum(["json", "csv"]).default("json"),
  })
  .refine(rangeRule, rangeError);
export type ReportQuery = z.infer<typeof reportQuerySchema>;

// ───────────── Orders ─────────────

export const ADMIN_ORDER_SORTS = ["newest", "oldest", "total_desc", "total_asc"] as const;

export const adminOrderListQuerySchema = paginationSchema
  .extend({
    q: z.string().trim().max(100).optional(),
    status: csv(z.enum(ORDER_STATUSES)).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    ...dateRange,
    sort: z.enum(ADMIN_ORDER_SORTS).default("newest"),
  })
  .refine(rangeRule, rangeError);
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

/** Internal notes and shipment details (status changes use updateOrderStatusSchema). */
export const updateAdminOrderSchema = z
  .object({
    adminNotes: optionalText(2000),
    trackingNumber: optionalText(60),
    courier: optionalText(60),
  })
  .partial();
export type UpdateAdminOrderInput = z.infer<typeof updateAdminOrderSchema>;

export const refundOrderSchema = z.object({
  /** Minor units. Omit to refund everything not yet refunded. */
  amount: moneySchema.positive("Enter an amount above zero").optional(),
  reason: z.string().trim().min(3, "Give a short reason").max(300),
  /** Put the items back in stock (only for a full refund). Defaults to true if not yet shipped. */
  restock: z.boolean().optional(),
});
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

// ───────────── Customers ─────────────

export const customerListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["active", "blocked"]).optional(),
  sort: z.enum(["newest", "oldest", "spent", "orders", "name"]).default("newest"),
});
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

export const updateCustomerSchema = z.object({ adminNote: optionalText(2000) });
export const blockCustomerSchema = z.object({ isBlocked: z.boolean() });

// ───────────── Inventory ─────────────

export const inventoryQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  stock: z.enum(["all", "low", "out"]).default("all"),
  category: z.string().optional(),
  sort: z.enum(["stock_asc", "stock_desc", "product", "sku"]).default("stock_asc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;

// ───────────── Coupons ─────────────

const couponFields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,30}$/, "3-30 letters, numbers or hyphens"),
  description: optionalText(200),
  type: z.enum(DISCOUNT_TYPES),
  /** Percent (1-100) for PERCENTAGE, minor units for FIXED, ignored for FREE_SHIPPING. */
  value: z.number().int().nonnegative(),
  minOrderAmount: moneySchema.nullable(),
  maxUses: z.number().int().positive().nullable(),
  maxUsesPerUser: z.number().int().positive().nullable(),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
  isActive: z.boolean(),
};

type CouponShape = {
  type?: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  value?: number;
  startsAt?: string | null;
  endsAt?: string | null;
};
const couponValueRule = (d: CouponShape) =>
  d.type === undefined ||
  d.value === undefined ||
  (d.type === "PERCENTAGE" && d.value >= 1 && d.value <= 100) ||
  (d.type === "FIXED" && d.value > 0) ||
  d.type === "FREE_SHIPPING";
const couponDatesRule = (d: CouponShape) =>
  !d.startsAt || !d.endsAt || new Date(d.startsAt) < new Date(d.endsAt);

export const createCouponSchema = z
  .object({
    ...couponFields,
    description: couponFields.description.optional(),
    value: couponFields.value.default(0),
    minOrderAmount: couponFields.minOrderAmount.optional(),
    maxUses: couponFields.maxUses.optional(),
    maxUsesPerUser: couponFields.maxUsesPerUser.optional(),
    startsAt: couponFields.startsAt.optional(),
    endsAt: couponFields.endsAt.optional(),
    isActive: couponFields.isActive.default(true),
  })
  .refine(couponValueRule, {
    message: "Percentage must be 1-100; a fixed amount must be above zero",
    path: ["value"],
  })
  .refine(couponDatesRule, { message: "The end must be after the start", path: ["endsAt"] });
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

/** `type` and `value` are validated together on the server against the stored coupon. */
export const updateCouponSchema = z
  .object(couponFields)
  .partial()
  .refine(couponValueRule, {
    message: "Percentage must be 1-100; a fixed amount must be above zero",
    path: ["value"],
  })
  .refine(couponDatesRule, { message: "The end must be after the start", path: ["endsAt"] });
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

// ───────────── Shipping zones ─────────────

const region = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(60)
  .regex(/^(\*|[\p{L}\p{N} .'-]+)$/u, "Use a city name, a country code, or * for everywhere else");

const zoneFields = {
  name: z.string().trim().min(2).max(60),
  regions: z
    .array(region)
    .min(1, "Add at least one city (or * for everywhere else)")
    .max(200)
    .transform((r) => [...new Set(r)]),
  standardRate: moneySchema,
  expressRate: moneySchema.nullable(),
  freeOverAmount: moneySchema.nullable(),
  codFee: moneySchema,
  codEnabled: z.boolean(),
  estimatedDays: z.string().trim().min(1).max(20),
  position: z.number().int().nonnegative(),
  isActive: z.boolean(),
};

export const createShippingZoneSchema = z.object({
  ...zoneFields,
  expressRate: zoneFields.expressRate.optional(),
  freeOverAmount: zoneFields.freeOverAmount.optional(),
  codFee: zoneFields.codFee.default(0),
  codEnabled: zoneFields.codEnabled.default(true),
  position: zoneFields.position.default(0),
  isActive: zoneFields.isActive.default(true),
});
export type CreateShippingZoneInput = z.infer<typeof createShippingZoneSchema>;
export const updateShippingZoneSchema = z.object(zoneFields).partial();
export type UpdateShippingZoneInput = z.infer<typeof updateShippingZoneSchema>;

// ───────────── Content (CMS) ─────────────

/** A site path ("/shop/hoodies") or a full https URL. */
const linkSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Use a path like /shop or a URL");

const bannerFields = {
  title: z.string().trim().min(2).max(80),
  subtitle: optionalText(160),
  imageUrl: z.url(),
  link: linkSchema.nullable(),
  ctaLabel: optionalText(30),
  position: z.number().int().nonnegative(),
  isActive: z.boolean(),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
};
const bannerDatesRule = (d: { startsAt?: string | null; endsAt?: string | null }) =>
  !d.startsAt || !d.endsAt || new Date(d.startsAt) < new Date(d.endsAt);

export const createBannerSchema = z
  .object({
    ...bannerFields,
    subtitle: bannerFields.subtitle.optional(),
    link: bannerFields.link.optional(),
    ctaLabel: bannerFields.ctaLabel.optional(),
    position: bannerFields.position.default(0),
    isActive: bannerFields.isActive.default(true),
    startsAt: bannerFields.startsAt.optional(),
    endsAt: bannerFields.endsAt.optional(),
  })
  .refine(bannerDatesRule, { message: "The end must be after the start", path: ["endsAt"] });
export const updateBannerSchema = z
  .object(bannerFields)
  .partial()
  .refine(bannerDatesRule, { message: "The end must be after the start", path: ["endsAt"] });

const pageFields = {
  slug: slugSchema,
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(1).max(50_000),
  seoDescription: optionalText(160),
  isPublished: z.boolean(),
};
export const createPageSchema = z.object({
  ...pageFields,
  seoDescription: pageFields.seoDescription.optional(),
  isPublished: pageFields.isPublished.default(true),
});
export const updatePageSchema = z.object(pageFields).partial();

const faqFields = {
  question: z.string().trim().min(5).max(200),
  answer: z.string().trim().min(2).max(2000),
  category: optionalText(40),
  position: z.number().int().nonnegative(),
  isActive: z.boolean(),
};
export const createFaqSchema = z.object({
  ...faqFields,
  category: faqFields.category.optional(),
  position: faqFields.position.default(0),
  isActive: faqFields.isActive.default(true),
});
export const updateFaqSchema = z.object(faqFields).partial();

export const announcementSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().max(160),
});

// ───────────── Messages ─────────────

export const messageListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(MESSAGE_STATUSES).optional(),
});
export const updateMessageSchema = z.object({ status: z.enum(MESSAGE_STATUSES) });
export const replyMessageSchema = z.object({
  body: z.string().trim().min(2, "Write a reply").max(5000),
});

// ───────────── Staff ─────────────

export const inviteStaffSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).max(80),
  role: z.enum(ADMIN_ROLES),
});
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const updateStaffSchema = z
  .object({ role: z.enum(ADMIN_ROLES), isBlocked: z.boolean() })
  .partial();
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

// ───────────── Store settings ─────────────

/** Settings editable from the admin panel, keyed exactly as stored. */
export const storeSettingsSchema = z.object({
  "store.name": z.string().trim().min(2).max(60),
  "store.email": emailSchema,
  "store.phone": z.string().trim().max(30),
  "store.address": z.string().trim().max(300),
  "tax.rate": z.number().min(0).max(50),
  "tax.inclusive": z.boolean(),
  "payments.card.enabled": z.boolean(),
  "payments.cod.enabled": z.boolean(),
  "returns.windowDays": z.number().int().min(0).max(90),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;
export const updateStoreSettingsSchema = storeSettingsSchema.partial();

// ───────────── Audit log ─────────────

export const auditLogQuerySchema = paginationSchema
  .extend({
    q: z.string().trim().max(100).optional(),
    entity: z.string().trim().max(40).optional(),
    adminId: z.string().optional(),
    ...dateRange,
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine(rangeRule, rangeError);
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
