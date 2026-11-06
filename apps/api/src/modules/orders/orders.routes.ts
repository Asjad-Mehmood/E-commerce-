import { paginationSchema, trackOrderSchema } from "@hoodie/validation";
import { z } from "zod";
import { ok } from "../../lib/http";
import { storeInfo } from "../../lib/settings";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import { renderInvoice } from "./invoice";
import * as orders from "./orders.service";

const tokenQuery = z.object({ token: z.string().max(100).optional() });
const viewer = (req: { user?: { id: string } }, token?: string): orders.Viewer => ({
  userId: req.user?.id,
  token,
});

export const ordersRouter = defineRoutes("/orders", "Orders", [
  route({
    method: "get",
    path: "/track",
    summary: "Track an order by number and email (limited details)",
    access: "public",
    rateLimit: "forms",
    query: trackOrderSchema,
    handler: async ({ query }) => ok(await orders.trackOrder(query.number, query.email)),
  }),
  route({
    method: "get",
    path: "/:number",
    summary: "Order details for the signed-in owner, or anyone with the order link token",
    access: "optional",
    query: tokenQuery,
    handler: async ({ req, params, query }) =>
      ok(await orders.getOrder(params.number!, viewer(req, query.token))),
  }),
  route({
    method: "get",
    path: "/:number/payment",
    summary: "Reopen the card payment for an unpaid order",
    access: "optional",
    query: tokenQuery,
    handler: async ({ req, params, query }) =>
      ok(await orders.paymentSession(params.number!, viewer(req, query.token))),
  }),
  route({
    method: "post",
    path: "/:number/cancel",
    summary: "Cancel an order that is not yet being prepared",
    description:
      "Allowed while awaiting payment or confirmed (Cash on Delivery). Stock is returned.",
    access: "optional",
    query: tokenQuery,
    handler: async ({ req, params, query }) =>
      ok(await orders.cancelByCustomer(params.number!, viewer(req, query.token))),
  }),
  route({
    method: "get",
    path: "/:number/invoice",
    summary: "Download the invoice (PDF)",
    access: "optional",
    query: tokenQuery,
    handler: async ({ req, res, params, query }) => {
      const order = await orders.findViewableOrder(params.number!, viewer(req, query.token));
      const pdf = await renderInvoice(order, await storeInfo());
      res
        .status(200)
        .type("application/pdf")
        .set("Content-Disposition", `attachment; filename="invoice-${order.orderNumber}.pdf"`)
        .send(pdf);
    },
  }),
]);

export const myOrdersRouter = defineRoutes("/me/orders", "Orders", [
  route({
    method: "get",
    path: "",
    summary: "The signed-in customer's orders, newest first",
    access: "user",
    query: paginationSchema,
    handler: ({ req, query }) => orders.listMyOrders(currentUser(req).id, query),
  }),
]);
