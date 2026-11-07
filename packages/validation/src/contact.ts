import { z } from "zod";
import { emailSchema } from "./common";

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10).max(5000),
});
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export const newsletterSchema = z.object({ email: emailSchema });

export const stockAlertSchema = z.object({ email: emailSchema, variantId: z.string().min(1) });
