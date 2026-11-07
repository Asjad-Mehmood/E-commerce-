import { FITS, PRODUCT_SORTS, PRODUCT_STATUSES, SIZES } from "@hoodie/types";
import { z } from "zod";
import { hexColorSchema, moneySchema, paginationSchema, slugSchema } from "./common";

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(item));

/*
 * IMPORTANT: Zod 4 applies `.default()` values even inside `.partial()`.
 * So each resource defines its fields WITHOUT defaults (`*Fields`), the create
 * schema adds the defaults, and the update schema is a plain partial of the
 * fields. Otherwise a PATCH that renames a product would also reset its status,
 * images and categories.
 */

const variantFields = {
  sku: z.string().trim().min(1).max(64),
  size: z.enum(SIZES),
  color: z.string().trim().min(1).max(40),
  colorHex: hexColorSchema.optional(),
  price: moneySchema.optional(),
  stock: z.number().int().nonnegative(),
  lowStockAt: z.number().int().nonnegative(),
  weightGrams: z.number().int().positive().optional(),
  isActive: z.boolean(),
};

export const variantSchema = z.object({
  ...variantFields,
  stock: variantFields.stock.default(0),
  lowStockAt: variantFields.lowStockAt.default(5),
  isActive: variantFields.isActive.default(true),
});
export type VariantInput = z.infer<typeof variantSchema>;

export const productImageSchema = z.object({
  url: z.url(),
  alt: z.string().max(200).optional(),
  color: z.string().max(40).optional(),
  position: z.number().int().nonnegative().default(0),
});

const productFields = {
  title: z.string().trim().min(3).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().min(10),
  fit: z.enum(FITS),
  fabric: z.string().max(200).optional(),
  careInfo: z.string().max(500).optional(),
  basePrice: moneySchema.positive(),
  compareAtPrice: moneySchema.nullable().optional(),
  status: z.enum(PRODUCT_STATUSES),
  isFeatured: z.boolean(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  categoryIds: z.array(z.string()),
  collectionIds: z.array(z.string()),
  images: z.array(productImageSchema),
};

const comparePriceRule = (d: { basePrice?: number; compareAtPrice?: number | null }) =>
  d.compareAtPrice == null || d.basePrice === undefined || d.compareAtPrice > d.basePrice;

const uniqueVariantsRule = (d: { variants?: { size: string; color: string }[] }) => {
  const keys = (d.variants ?? []).map((v) => `${v.size}|${v.color.toLowerCase()}`);
  return new Set(keys).size === keys.length;
};

export const createProductSchema = z
  .object({
    ...productFields,
    fit: productFields.fit.default("REGULAR"),
    status: productFields.status.default("DRAFT"),
    isFeatured: productFields.isFeatured.default(false),
    categoryIds: productFields.categoryIds.default([]),
    collectionIds: productFields.collectionIds.default([]),
    images: productFields.images.default([]),
    variants: z.array(variantSchema).default([]),
  })
  .refine(comparePriceRule, {
    message: "Compare-at price must be higher than the price",
    path: ["compareAtPrice"],
  })
  .refine(uniqueVariantsRule, {
    message: "Each size + colour combination must be unique",
    path: ["variants"],
  });
export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Variants are managed through their own endpoints (generate / add / update /
 * adjust stock), so they are not accepted here. `images`, when given, replaces
 * the whole gallery in the order provided.
 */
export const updateProductSchema = z
  .object(productFields)
  .partial()
  .refine(comparePriceRule, {
    message: "Compare-at price must be higher than the price",
    path: ["compareAtPrice"],
  });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** Admin helper: generate the size × colour variant matrix. */
export const generateVariantsSchema = z.object({
  sizes: z.array(z.enum(SIZES)).min(1),
  colors: z
    .array(z.object({ name: z.string().trim().min(1).max(40), hex: hexColorSchema.optional() }))
    .min(1),
  skuPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/),
  initialStock: z.number().int().nonnegative().default(0),
});

/** Public product listing query (`GET /products`). */
export const productListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  collection: z.string().optional(),
  size: csv(z.enum(SIZES)).optional(),
  color: csv(z.string()).optional(),
  fit: csv(z.enum(FITS)).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  inStock: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(PRODUCT_SORTS).default("newest"),
  /** Specific products, in this order (e.g. "recently viewed"). Other filters still apply. */
  slugs: csv(z.string().max(120)).pipe(z.array(z.string()).max(24)).optional(),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** A single variant added by an admin. */
export const createVariantSchema = variantSchema;

/** Variant fields an admin may edit. Stock changes go through `stockAdjustmentSchema`. */
export const updateVariantSchema = z
  .object({ ...variantFields, price: moneySchema.nullable() })
  .omit({ stock: true })
  .partial();
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const STOCK_ADJUSTMENT_REASONS = [
  "restock",
  "damaged",
  "lost",
  "returned",
  "correction",
] as const;

export const stockAdjustmentSchema = z.object({
  change: z
    .number()
    .int()
    .refine((n) => n !== 0, "Change cannot be zero"),
  reason: z.enum(STOCK_ADJUSTMENT_REASONS),
  note: z.string().trim().max(300).optional(),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

/** Admin product list query (`GET /admin/products`). */
export const adminProductListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  category: z.string().optional(),
  lowStock: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z
    .enum(["updated", "newest", "title", "price_asc", "price_desc", "best_selling"])
    .default("updated"),
});
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;

export const bulkProductActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["publish", "unpublish", "archive"]),
});
export type BulkProductActionInput = z.infer<typeof bulkProductActionSchema>;
