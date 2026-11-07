import type { ProductCardDTO } from "@hoodie/types";
import { ok } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { cardInclude, toProductCard } from "../catalog/catalog.mapper";

const MAX_ITEMS = 100;

export const wishlistRouter = defineRoutes("/me/wishlist", "Account", [
  route({
    method: "get",
    path: "",
    summary: "The signed-in customer's saved products, newest first",
    description: "Products that are no longer for sale are left out.",
    access: "user",
    handler: async ({ req }) => {
      const items = await prisma.wishlistItem.findMany({
        where: { userId: currentUser(req).id, product: { status: "ACTIVE" } },
        include: { product: { include: cardInclude } },
        orderBy: { createdAt: "desc" },
      });
      return ok<ProductCardDTO[]>(items.map((i) => toProductCard(i.product)));
    },
  }),
  route({
    method: "get",
    path: "/ids",
    summary: "IDs of saved products (to fill the heart icons)",
    access: "user",
    handler: async ({ req }) => {
      const items = await prisma.wishlistItem.findMany({
        where: { userId: currentUser(req).id },
        select: { productId: true },
      });
      return ok(items.map((i) => i.productId));
    },
  }),
  route({
    method: "put",
    path: "/:productId",
    summary: "Save a product (idempotent)",
    access: "user",
    handler: async ({ req, params }) => {
      const userId = currentUser(req).id;
      const product = await prisma.product.findFirst({
        where: { id: params.productId!, status: "ACTIVE" },
        select: { id: true },
      });
      if (!product) throw AppError.notFound("Product");
      const existing = await prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId, productId: product.id } },
      });
      if (!existing && (await prisma.wishlistItem.count({ where: { userId } })) >= MAX_ITEMS) {
        throw AppError.conflict(`Your wishlist is full (${MAX_ITEMS} items). Remove some first.`);
      }
      await prisma.wishlistItem.upsert({
        where: { userId_productId: { userId, productId: product.id } },
        create: { userId, productId: product.id },
        update: {},
      });
    },
  }),
  route({
    method: "delete",
    path: "/:productId",
    summary: "Remove a saved product (idempotent)",
    access: "user",
    handler: async ({ req, params }) => {
      await prisma.wishlistItem.deleteMany({
        where: { userId: currentUser(req).id, productId: params.productId! },
      });
    },
  }),
]);
