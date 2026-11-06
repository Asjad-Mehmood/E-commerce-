import { addCartItemSchema, updateCartItemSchema } from "@hoodie/validation";
import type { Request } from "express";
import { COOKIE, setCartCookie } from "../../lib/cookies";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import * as cart from "./cart.service";

function owner(req: Request): cart.CartOwner {
  if (req.user) return { userId: req.user.id };
  const token = (req.cookies as Record<string, string | undefined> | undefined)?.[COOKIE.cart];
  return { guestToken: token };
}

export const cartRouter = defineRoutes("/cart", "Cart", [
  route({
    method: "get",
    path: "",
    summary: "Get the current cart",
    description:
      "Works for guests (cart cookie) and signed-in users. `warnings` lists items that must be fixed before checkout (sold out, quantity above stock, unpublished).",
    access: "optional",
    handler: async ({ req }) => ok(await cart.getCart(owner(req))),
  }),
  route({
    method: "post",
    path: "/items",
    summary: "Add a variant to the cart",
    description:
      "Adds to the existing quantity if the variant is already in the cart. Returns 409 OUT_OF_STOCK if not enough is available.",
    access: "optional",
    body: addCartItemSchema,
    handler: async ({ req, res, body }) => {
      const result = await cart.addItem(owner(req), body.variantId, body.quantity);
      if (result.newGuestToken) setCartCookie(res, result.newGuestToken);
      return ok(result.cart);
    },
  }),
  route({
    method: "patch",
    path: "/items/:id",
    summary: "Change an item's quantity",
    access: "optional",
    body: updateCartItemSchema,
    handler: async ({ req, body, params }) =>
      ok(await cart.updateItem(owner(req), params.id!, body.quantity)),
  }),
  route({
    method: "delete",
    path: "/items/:id",
    summary: "Remove an item",
    access: "optional",
    handler: async ({ req, params }) => ok(await cart.removeItem(owner(req), params.id!)),
  }),
  route({
    method: "delete",
    path: "",
    summary: "Empty the cart",
    access: "optional",
    handler: async ({ req }) => ok(await cart.clearCart(owner(req))),
  }),
]);
