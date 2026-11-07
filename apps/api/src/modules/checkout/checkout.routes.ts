import { checkoutSchema, quoteSchema } from "@hoodie/validation";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import { owner } from "../cart/cart.routes";
import * as checkout from "./checkout.service";

export const checkoutRouter = defineRoutes("/checkout", "Checkout", [
  route({
    method: "post",
    path: "/quote",
    summary: "Price the cart for a city, delivery method and payment method",
    description:
      "Returns delivery options, available payment methods, the coupon status and the full total breakdown.",
    access: "optional",
    body: quoteSchema,
    handler: async ({ req, body }) =>
      ok(await checkout.quote(owner(req), body, { userId: req.user?.id, email: req.user?.email })),
  }),
  route({
    method: "post",
    path: "",
    summary: "Place an order from the cart",
    description:
      "Cash on Delivery orders are confirmed immediately. Card orders are created as PENDING_PAYMENT with stock held for 15 minutes, and the response includes a `payment` session for the card form. A repeated `idempotencyKey` returns the same order.",
    access: "optional",
    rateLimit: "checkout",
    body: checkoutSchema,
    status: 201,
    handler: async ({ req, body }) => ok(await checkout.placeOrder(owner(req), body)),
  }),
]);
