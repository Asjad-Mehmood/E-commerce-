import { productListQuerySchema } from "@hoodie/validation";
import { z } from "zod";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import * as catalog from "./catalog.service";

const scopeQuery = z.object({
  category: z.string().optional(),
  collection: z.string().optional(),
});

export const productsRouter = defineRoutes("/products", "Catalog", [
  route({
    method: "get",
    path: "",
    summary: "List published products",
    description:
      "Filters: `q` (search), `category`, `collection`, `size` / `color` / `fit` (comma-separated), `minPrice` / `maxPrice` (minor units), `inStock=true`. Size, colour and stock filters must match the same variant.",
    access: "public",
    query: productListQuerySchema,
    handler: ({ query }) => catalog.listProducts(query),
  }),
  route({
    method: "get",
    path: "/:slug",
    summary: "Get a published product with variants and images",
    access: "public",
    handler: async ({ params }) => ok(await catalog.getProduct(params.slug!)),
  }),
  route({
    method: "get",
    path: "/:slug/related",
    summary: "Related products (same categories, best sellers first)",
    access: "public",
    handler: async ({ params }) => ok(await catalog.relatedProducts(params.slug!)),
  }),
]);

export const categoriesRouter = defineRoutes("/categories", "Catalog", [
  route({
    method: "get",
    path: "",
    summary: "Category tree with published product counts",
    access: "public",
    handler: async () => ok(await catalog.listCategories()),
  }),
  route({
    method: "get",
    path: "/:slug",
    summary: "Get a category",
    access: "public",
    handler: async ({ params }) => ok(await catalog.getCategory(params.slug!)),
  }),
]);

export const collectionsRouter = defineRoutes("/collections", "Catalog", [
  route({
    method: "get",
    path: "",
    summary: "List collections",
    access: "public",
    query: z.object({ featured: z.enum(["true", "false"]).optional() }),
    handler: async ({ query }) => ok(await catalog.listCollections(query.featured === "true")),
  }),
  route({
    method: "get",
    path: "/:slug",
    summary: "Get a collection",
    access: "public",
    handler: async ({ params }) => ok(await catalog.getCollection(params.slug!)),
  }),
]);

export const filtersRouter = defineRoutes("/filters", "Catalog", [
  route({
    method: "get",
    path: "",
    summary: "Available filter options (sizes, colours, fits, price range)",
    access: "public",
    query: scopeQuery,
    handler: async ({ query }) => ok(await catalog.getFilters(query)),
  }),
]);
