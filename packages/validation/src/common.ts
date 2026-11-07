import { z } from "zod";

export const idSchema = z.string().min(1, "ID is required");

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

/** Money in minor units (paisa / cents). */
export const moneySchema = z.number().int("Amount must be in minor units").nonnegative();

/** Trims and lower-cases BEFORE validating, so " Ali@Example.com " is accepted. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

/** International or Pakistani local format, e.g. +923001234567 or 03001234567. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+?\d{10,15}|0\d{10})$/, "Enter a valid phone number"));

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, e.g. #111111");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
