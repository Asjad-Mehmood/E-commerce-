import { z } from "zod";
import { phoneSchema } from "./common";

export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().min(3).max(12),
  country: z.string().trim().length(2, "Use a 2-letter country code").toUpperCase().default("PK"),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;
