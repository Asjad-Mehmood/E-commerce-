import { z } from "zod";
import { slugSchema } from "./common";

// Fields are defined without defaults so update (partial) schemas never inject
// default values. See the note in product.ts.

const categoryFields = {
  name: z.string().trim().min(2).max(60),
  slug: slugSchema,
  description: z.string().trim().max(500).nullable(),
  imageUrl: z.url().nullable(),
  parentId: z.string().min(1).nullable(),
  position: z.number().int().nonnegative(),
};

export const createCategorySchema = z.object({
  ...categoryFields,
  slug: categoryFields.slug.optional(),
  description: categoryFields.description.optional(),
  imageUrl: categoryFields.imageUrl.optional(),
  parentId: categoryFields.parentId.optional(),
  position: categoryFields.position.default(0),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object(categoryFields).partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

const collectionFields = {
  name: z.string().trim().min(2).max(60),
  slug: slugSchema,
  description: z.string().trim().max(500).nullable(),
  bannerUrl: z.url().nullable(),
  isFeatured: z.boolean(),
  position: z.number().int().nonnegative(),
};

export const createCollectionSchema = z.object({
  ...collectionFields,
  slug: collectionFields.slug.optional(),
  description: collectionFields.description.optional(),
  bannerUrl: collectionFields.bannerUrl.optional(),
  isFeatured: collectionFields.isFeatured.default(false),
  position: collectionFields.position.default(0),
});
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = z.object(collectionFields).partial();
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
