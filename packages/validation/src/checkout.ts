import { ORDER_STATUSES } from "@hoodie/types";
import { z } from "zod";
import { addressSchema } from "./address";
import { emailSchema, phoneSchema } from "./common";

export const SHIPPING_METHODS = ["standard", "express"] as const;
export const CHECKOUT_PAYMENT_METHODS = ["STRIPE", "COD"] as const;

export const quoteSchema = z.object({
  city: z.string().trim().max(80).default(""),
  shippingMethod: z.enum(SHIPPING_METHODS).default("standard"),
  paymentMethod: z.enum(CHECKOUT_PAYMENT_METHODS).default("COD"),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const checkoutSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  shippingAddress: addressSchema.omit({ isDefault: true }),
  shippingMethod: z.enum(SHIPPING_METHODS),
  paymentMethod: z.enum(CHECKOUT_PAYMENT_METHODS),
  customerNote: z.string().trim().max(500).optional(),
  /** Signed-in customers: also save this address to their address book. */
  saveAddress: z.boolean().default(false),
  /** Random key generated once per checkout attempt; a resubmit returns the same order. */
  idempotencyKey: z.string().min(16).max(100),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackOrderSchema = z.object({
  number: z.string().trim().toUpperCase().min(3).max(30),
  email: emailSchema,
});

/** Demo payment mode only. Real card details never reach the API. */
export const demoPaymentSchema = z.object({
  clientSecret: z.string().min(10),
  cardNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{12,19}$/, "Enter a card number")),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY"),
  cvc: z.string().regex(/^\d{3,4}$/, "Enter the 3 or 4 digit code"),
});
export type DemoPaymentInput = z.infer<typeof demoPaymentSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
  trackingNumber: z.string().trim().max(60).optional(),
  courier: z.string().trim().max(60).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
