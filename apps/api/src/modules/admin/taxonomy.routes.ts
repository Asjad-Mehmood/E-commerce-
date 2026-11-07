import {
  createCategorySchema,
  createCollectionSchema,
  updateCategorySchema,
  updateCollectionSchema,
} from "@hoodie/validation";
import { audit } from "../../lib/audit";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import * as taxonomy from "./taxonomy.service";

export const adminCategoriesRouter = defineRoutes(
  "/admin/categories",
  "Admin: Categories & Collections",
  [
    route({
      method: "get",
      path: "",
      summary: "List all categories (flat, with product counts)",
      access: "MANAGER",
      handler: async () => ok(await taxonomy.listCategories()),
    }),
    route({
      method: "post",
      path: "",
      summary: "Create a category",
      access: "MANAGER",
      body: createCategorySchema,
      status: 201,
      handler: async ({ req, body }) => {
        const category = await taxonomy.createCategory(body);
        await audit(req, "category.create", "Category", category.id, { name: category.name });
        return ok(category);
      },
    }),
    route({
      method: "patch",
      path: "/:id",
      summary: "Update a category",
      description: "Rejects moving a category under itself or one of its own sub-categories.",
      access: "MANAGER",
      body: updateCategorySchema,
      handler: async ({ req, body, params }) => {
        const category = await taxonomy.updateCategory(params.id!, body);
        await audit(req, "category.update", "Category", category.id, body);
        return ok(category);
      },
    }),
    route({
      method: "delete",
      path: "/:id",
      summary: "Delete a category",
      description: "Its sub-categories move to the top level. Products are not deleted.",
      access: "MANAGER",
      handler: async ({ req, params }) => {
        await taxonomy.deleteCategory(params.id!);
        await audit(req, "category.delete", "Category", params.id!);
      },
    }),
  ],
);

export const adminCollectionsRouter = defineRoutes(
  "/admin/collections",
  "Admin: Categories & Collections",
  [
    route({
      method: "get",
      path: "",
      summary: "List all collections (with product counts)",
      access: "MANAGER",
      handler: async () => ok(await taxonomy.listCollections()),
    }),
    route({
      method: "post",
      path: "",
      summary: "Create a collection",
      access: "MANAGER",
      body: createCollectionSchema,
      status: 201,
      handler: async ({ req, body }) => {
        const collection = await taxonomy.createCollection(body);
        await audit(req, "collection.create", "Collection", collection.id, {
          name: collection.name,
        });
        return ok(collection);
      },
    }),
    route({
      method: "patch",
      path: "/:id",
      summary: "Update a collection",
      access: "MANAGER",
      body: updateCollectionSchema,
      handler: async ({ req, body, params }) => {
        const collection = await taxonomy.updateCollection(params.id!, body);
        await audit(req, "collection.update", "Collection", collection.id, body);
        return ok(collection);
      },
    }),
    route({
      method: "delete",
      path: "/:id",
      summary: "Delete a collection (products are not deleted)",
      access: "MANAGER",
      handler: async ({ req, params }) => {
        await taxonomy.deleteCollection(params.id!);
        await audit(req, "collection.delete", "Collection", params.id!);
      },
    }),
  ],
);
