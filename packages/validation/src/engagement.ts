import { z } from "zod";
import { emailSchema, moneySchema, paginationSchema } from "./common";

// ───────────── Reviews ─────────────

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Choose a rating").max(5),
  title: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null)
    .nullable()
    .optional(),
  body: z
    .string()
    .trim()
    .min(10, "Tell other shoppers a little more (at least 10 characters)")
    .max(2000),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const reviewListQuerySchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(["newest", "highest", "lowest"]).default("newest"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export const adminReviewListQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "approved", "all"]).default("pending"),
  q: z.string().trim().max(100).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export const moderateReviewSchema = z
  .object({
    isApproved: z.boolean(),
    adminReply: z
      .string()
      .trim()
      .max(1000)
      .transform((v) => v || null)
      .nullable(),
  })
  .partial();

// ───────────── Returns ─────────────

export const RETURN_REASONS = [
  "wrong_size",
  "not_as_described",
  "damaged",
  "wrong_item",
  "changed_mind",
  "other",
] as const;

export const returnRequestSchema = z
  .object({
    items: z
      .array(
        z.object({
          orderItemId: z.string().min(1),
          quantity: z.number().int().min(1),
        }),
      )
      .min(1, "Choose at least one item to return"),
    reason: z.enum(RETURN_REASONS),
    details: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.reason !== "other" || (d.details?.length ?? 0) >= 3, {
    message: "Tell us a little about the problem",
    path: ["details"],
  })
  .refine((d) => new Set(d.items.map((i) => i.orderItemId)).size === d.items.length, {
    message: "Each item can only be listed once",
    path: ["items"],
  });
export type ReturnRequestInput = z.infer<typeof returnRequestSchema>;

export const adminReturnListQuerySchema = paginationSchema.extend({
  status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "REFUNDED", "open"]).optional(),
});

export const returnNoteSchema = z.object({ note: z.string().trim().max(500).optional() });
export const rejectReturnSchema = z.object({
  note: z.string().trim().min(3, "Tell the customer why").max(500),
});
export const receiveReturnSchema = z.object({
  restock: z.boolean().default(true),
  note: z.string().trim().max(500).optional(),
});
export const refundReturnSchema = z.object({
  amount: moneySchema.positive().optional(),
  note: z.string().trim().max(300).optional(),
});

// ───────────── Email preferences, newsletter, search ─────────────

export const unsubscribeSchema = z.object({
  type: z.enum(["newsletter", "cart"]),
  email: emailSchema,
  token: z.string().min(10).max(100),
});

export const newsletterListQuerySchema = paginationSchema.extend({
  status: z.enum(["active", "unsubscribed"]).default("active"),
  q: z.string().trim().max(100).optional(),
  format: z.enum(["json", "csv"]).default("json"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const searchSuggestSchema = z.object({ q: z.string().trim().min(1).max(100) });
