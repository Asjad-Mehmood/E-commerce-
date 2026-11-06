import { FITS, PRODUCT_SORTS, PRODUCT_STATUSES, SIZES } from "@hoodie/types";
import { z } from "zod";
import { hexColorSchema, moneySchema, paginationSchema, slugSchema } from "./common";

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(item));

export const variantSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  size: z.enum(SIZES),
  color: z.string().trim().min(1).max(40),
  colorHex: hexColorSchema.optional(),
  price: moneySchema.optional(),
  stock: z.number().int().nonnegative().default(0),
  lowStockAt: z.number().int().nonnegative().default(5),
  weightGrams: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});
export type VariantInput = z.infer<typeof variantSchema>;

export const productImageSchema = z.object({
  url: z.url(),
  alt: z.string().max(200).optional(),
  color: z.string().max(40).optional(),
  position: z.number().int().nonnegative().default(0),
});

export const productBaseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().min(10),
  fit: z.enum(FITS).default("REGULAR"),
  fabric: z.string().max(200).optional(),
  careInfo: z.string().max(500).optional(),
  basePrice: moneySchema.positive(),
  compareAtPrice: moneySchema.optional(),
  status: z.enum(PRODUCT_STATUSES).default("DRAFT"),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  categoryIds: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
  images: z.array(productImageSchema).default([]),
  variants: z.array(variantSchema).default([]),
});

const comparePriceRule = (d: { basePrice?: number; compareAtPrice?: number }) =>
  d.compareAtPrice === undefined || d.basePrice === undefined || d.compareAtPrice > d.basePrice;

const uniqueVariantsRule = (d: { variants?: { size: string; color: string }[] }) => {
  const keys = (d.variants ?? []).map((v) => `${v.size}|${v.color.toLowerCase()}`);
  return new Set(keys).size === keys.length;
};

export const createProductSchema = productBaseSchema
  .refine(comparePriceRule, {
    message: "Compare-at price must be higher than the price",
    path: ["compareAtPrice"],
  })
  .refine(uniqueVariantsRule, {
    message: "Each size + colour combination must be unique",
    path: ["variants"],
  });
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = productBaseSchema.partial();
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
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
