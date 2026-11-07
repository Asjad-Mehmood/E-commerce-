import { z } from "zod";
import { idSchema } from "./common";

export const MAX_QTY_PER_ITEM = 10;

export const addCartItemSchema = z.object({
  variantId: idSchema,
  quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM).default(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

export const applyCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(32),
});
