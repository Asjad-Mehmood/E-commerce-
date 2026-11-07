import { z } from "zod";

export const UPLOAD_FOLDERS = [
  "products",
  "categories",
  "collections",
  "banners",
  "reviews",
] as const;

export const uploadSignSchema = z.object({
  folder: z.enum(UPLOAD_FOLDERS),
});
export type UploadSignInput = z.infer<typeof uploadSignSchema>;
