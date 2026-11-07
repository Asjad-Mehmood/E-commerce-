import {
  adminProductListQuerySchema,
  bulkProductActionSchema,
  createProductSchema,
  createVariantSchema,
  generateVariantsSchema,
  stockAdjustmentSchema,
  updateProductSchema,
  updateVariantSchema,
} from "@hoodie/validation";
import { audit } from "../../lib/audit";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import * as products from "./products.service";

export const adminProductsRouter = defineRoutes("/admin/products", "Admin: Products", [
  route({
    method: "get",
    path: "",
    summary: "List products (all statuses except archived by default)",
    description:
      "Search `q` matches title, slug and SKU. `lowStock=true` shows products with any variant at or below its low-stock threshold.",
    access: "MANAGER",
    query: adminProductListQuerySchema,
    handler: ({ query }) => products.listProducts(query),
  }),
  route({
    method: "post",
    path: "",
    summary: "Create a product (optionally with variants and images)",
    description: "The slug is generated from the title when omitted (and made unique).",
    access: "MANAGER",
    body: createProductSchema,
    status: 201,
    handler: async ({ req, body }) => {
      const product = await products.createProduct(body);
      await audit(req, "product.create", "Product", product.id, { title: product.title });
      return ok(product);
    },
  }),
  route({
    method: "post",
    path: "/bulk",
    summary: "Publish, unpublish or archive several products",
    access: "MANAGER",
    body: bulkProductActionSchema,
    handler: async ({ req, body }) => {
      const result = await products.bulkAction(body);
      await audit(req, `product.bulk.${body.action}`, "Product", body.ids.join(","), {
        ids: body.ids,
      });
      return ok(result);
    },
  }),
  route({
    method: "get",
    path: "/:id",
    summary: "Get a product with all variants (including stock) and images",
    access: "MANAGER",
    handler: async ({ params }) => ok(await products.getProduct(params.id!)),
  }),
  route({
    method: "patch",
    path: "/:id",
    summary: "Update a product",
    description:
      "Only the fields sent are changed. `images`, when sent, replaces the gallery in that order. Variants are managed with the variant endpoints.",
    access: "MANAGER",
    body: updateProductSchema,
    handler: async ({ req, body, params }) => {
      const product = await products.updateProduct(params.id!, body);
      await audit(req, "product.update", "Product", product.id, body);
      return ok(product);
    },
  }),
  route({
    method: "delete",
    path: "/:id",
    summary: "Archive a product",
    description: "Products are archived, not deleted, so past orders keep their references.",
    access: "MANAGER",
    handler: async ({ req, params }) => {
      await products.archiveProduct(params.id!);
      await audit(req, "product.archive", "Product", params.id!);
    },
  }),
  route({
    method: "post",
    path: "/:id/variants/generate",
    summary: "Generate the size × colour variant matrix",
    description:
      "Creates only the missing combinations, so it is safe to re-run after adding a colour. SKUs are `PREFIX-COL-SIZE`.",
    access: "MANAGER",
    body: generateVariantsSchema,
    status: 201,
    handler: async ({ req, body, params }) => {
      const result = await products.generateVariants(params.id!, body);
      await audit(req, "variant.generate", "Product", params.id!, { created: result.created });
      return ok(result);
    },
  }),
  route({
    method: "post",
    path: "/:id/variants",
    summary: "Add a single variant",
    access: "MANAGER",
    body: createVariantSchema,
    status: 201,
    handler: async ({ req, body, params }) => {
      const variant = await products.createVariant(params.id!, body);
      await audit(req, "variant.create", "ProductVariant", variant.id, { sku: variant.sku });
      return ok(variant);
    },
  }),
]);

export const adminVariantsRouter = defineRoutes("/admin/variants", "Admin: Products", [
  route({
    method: "patch",
    path: "/:id",
    summary: "Update a variant (price, SKU, colour, active, low-stock threshold)",
    description: "Stock is changed with the adjust-stock endpoint so every change is recorded.",
    access: "MANAGER",
    body: updateVariantSchema,
    handler: async ({ req, body, params }) => {
      const variant = await products.updateVariant(params.id!, body);
      await audit(req, "variant.update", "ProductVariant", variant.id, body);
      return ok(variant);
    },
  }),
  route({
    method: "delete",
    path: "/:id",
    summary: "Delete a variant that was never ordered",
    access: "MANAGER",
    handler: async ({ req, params }) => {
      await products.deleteVariant(params.id!);
      await audit(req, "variant.delete", "ProductVariant", params.id!);
    },
  }),
  route({
    method: "post",
    path: "/:id/adjust-stock",
    summary: "Adjust stock with a reason (restock, damaged, lost, returned, correction)",
    description:
      "Returns 409 if the change would take stock below zero or below units reserved by pending orders.",
    access: "MANAGER",
    body: stockAdjustmentSchema,
    handler: async ({ req, body, params }) => {
      const variant = await products.adjustStock(params.id!, body, currentUser(req).id);
      await audit(req, "variant.adjust-stock", "ProductVariant", variant.id, body);
      return ok(variant);
    },
  }),
  route({
    method: "get",
    path: "/:id/stock-history",
    summary: "Stock adjustment history (latest 100)",
    access: "MANAGER",
    handler: async ({ params }) => ok(await products.stockHistory(params.id!)),
  }),
]);
