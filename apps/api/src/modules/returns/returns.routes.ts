import {
  adminReturnListQuerySchema,
  receiveReturnSchema,
  refundReturnSchema,
  rejectReturnSchema,
  returnNoteSchema,
} from "@hoodie/validation";
import { audit } from "../../lib/audit";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import * as returns from "./returns.service";

export const adminReturnsRouter = defineRoutes("/admin/returns", "Admin: Returns", [
  route({
    method: "get",
    path: "",
    summary: "Return requests (`status=open` for everything still in progress)",
    access: "SUPPORT",
    query: adminReturnListQuerySchema,
    handler: ({ query }) => returns.listReturns(query),
  }),
  route({
    method: "get",
    path: "/:id",
    summary: "A return with its items, order and suggested refund",
    access: "SUPPORT",
    handler: async ({ params }) => ok(await returns.getReturn(params.id!)),
  }),
  route({
    method: "post",
    path: "/:id/approve",
    summary: "Approve a return: the customer is emailed where to send the items",
    access: "SUPPORT",
    body: returnNoteSchema,
    handler: async ({ req, params, body }) => {
      const r = await returns.approveReturn(params.id!, body.note, currentUser(req).id);
      await audit(req, "return.approve", "ReturnRequest", r.id, { order: r.order.number });
      return ok(r);
    },
  }),
  route({
    method: "post",
    path: "/:id/reject",
    summary: "Decline a return, with a reason that is emailed to the customer",
    access: "SUPPORT",
    body: rejectReturnSchema,
    handler: async ({ req, params, body }) => {
      const r = await returns.rejectReturn(params.id!, body.note, currentUser(req).id);
      await audit(req, "return.reject", "ReturnRequest", r.id, {
        order: r.order.number,
        note: body.note,
      });
      return ok(r);
    },
  }),
  route({
    method: "post",
    path: "/:id/receive",
    summary: "Mark the returned items as received (and restock them, by default)",
    access: "SUPPORT",
    body: receiveReturnSchema,
    handler: async ({ req, params, body }) => {
      const r = await returns.receiveReturn(params.id!, body, currentUser(req).id);
      await audit(req, "return.receive", "ReturnRequest", r.id, {
        order: r.order.number,
        restock: body.restock,
      });
      return ok(r);
    },
  }),
  route({
    method: "post",
    path: "/:id/refund",
    summary: "Refund a received return (defaults to the returned items' value)",
    description:
      "Card payments are refunded through the payment provider; Cash on Delivery refunds are recorded for staff to pay back.",
    access: "MANAGER",
    body: refundReturnSchema,
    handler: async ({ req, params, body }) => {
      const r = await returns.refundReturn(params.id!, body, currentUser(req).id);
      await audit(req, "return.refund", "ReturnRequest", r.id, {
        order: r.order.number,
        amount: r.refund.amount,
      });
      return ok(r);
    },
  }),
]);
