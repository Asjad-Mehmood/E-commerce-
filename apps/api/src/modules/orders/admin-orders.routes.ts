import { ORDER_STATUS_LABEL, type OrderAddressDTO } from "@hoodie/types";
import {
  adminOrderListQuerySchema,
  refundOrderSchema,
  updateAdminOrderSchema,
  updateOrderStatusSchema,
} from "@hoodie/validation";
import type { Response } from "express";
import { audit } from "../../lib/audit";
import { csvMoney, sendCsv } from "../../lib/csv";
import { ok } from "../../lib/http";
import { storeInfo } from "../../lib/settings";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import * as admin from "./admin-orders.service";
import { renderInvoice } from "./invoice";
import { updateOrderStatus } from "./lifecycle";
import { shippingLabel } from "./order.mapper";
import { renderPackingSlip } from "./packing-slip";
import { refundOrder } from "./refunds";

const pdf = (res: Response, filename: string, body: Buffer) =>
  res
    .status(200)
    .type("application/pdf")
    .set("Content-Disposition", `inline; filename="${filename}"`)
    .send(body);

export const adminOrdersRouter = defineRoutes("/admin/orders", "Admin: Orders", [
  route({
    method: "get",
    path: "",
    summary: "List orders with filters",
    description:
      "`q` matches the order number, email, phone or customer name. `status` takes a comma-separated list. `from`/`to` are days (YYYY-MM-DD) in the store's time zone.",
    access: "SUPPORT",
    query: adminOrderListQuerySchema,
    handler: ({ query }) => admin.listOrders(query),
  }),
  route({
    method: "get",
    path: "/export",
    summary: "Export the filtered orders as CSV (one row per item, up to 10,000 orders)",
    access: "SUPPORT",
    query: adminOrderListQuerySchema,
    handler: async ({ query, res }) => {
      const orders = await admin.ordersForExport(query);
      const rows = orders.flatMap((o) => {
        const a = o.shippingAddress as unknown as OrderAddressDTO;
        const refunded = o.payments.reduce((n, p) => n + p.refundedAmount, 0);
        return o.items.map((i, index) => [
          o.orderNumber,
          o.placedAt,
          ORDER_STATUS_LABEL[o.status],
          o.paymentMethod === "COD" ? "Cash on Delivery" : "Card",
          o.payments[0]?.status ?? "",
          a.fullName,
          o.email,
          o.phone,
          a.city,
          shippingLabel(o.shippingMethod),
          i.sku,
          i.productTitle,
          i.size,
          i.color,
          i.quantity,
          csvMoney(i.unitPrice),
          csvMoney(i.lineTotal),
          // Order-level money only on the first line, so columns can be summed.
          index === 0 ? csvMoney(o.subtotal) : "",
          index === 0 ? csvMoney(o.discountTotal) : "",
          index === 0 ? csvMoney(o.shippingTotal + o.codFee) : "",
          index === 0 ? csvMoney(o.taxTotal) : "",
          index === 0 ? csvMoney(o.grandTotal) : "",
          index === 0 ? csvMoney(refunded) : "",
          index === 0 ? (o.couponCode ?? "") : "",
          index === 0 ? (o.trackingNumber ?? "") : "",
        ]);
      });
      sendCsv(
        res,
        `orders-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Order",
          "Placed at (UTC)",
          "Status",
          "Payment method",
          "Payment status",
          "Customer",
          "Email",
          "Phone",
          "City",
          "Shipping",
          "SKU",
          "Product",
          "Size",
          "Colour",
          "Qty",
          "Unit price",
          "Line total",
          "Subtotal",
          "Discount",
          "Shipping & fees",
          "Tax",
          "Order total",
          "Refunded",
          "Coupon",
          "Tracking",
        ],
        rows,
      );
    },
  }),
  route({
    method: "get",
    path: "/:number",
    summary: "Order details with payments, refunds, staff timeline and available actions",
    access: "SUPPORT",
    handler: async ({ params }) => ok(await admin.getAdminOrder(params.number!)),
  }),
  route({
    method: "patch",
    path: "/:number",
    summary: "Update internal notes, tracking number or courier",
    access: "SUPPORT",
    body: updateAdminOrderSchema,
    handler: async ({ req, params, body }) => {
      const order = await admin.updateAdminOrder(params.number!, body);
      await audit(req, "order.update", "Order", order.id, { number: order.number, ...body });
      return ok(order);
    },
  }),
  route({
    method: "patch",
    path: "/:number/status",
    summary: "Move an order forward (processing → shipped → delivered) or cancel it",
    description:
      "Shipped and delivered email the customer. Cancelling returns the stock. Paid card orders are cancelled with a full refund instead.",
    access: "SUPPORT",
    body: updateOrderStatusSchema,
    handler: async ({ req, params, body }) => {
      const order = await admin.findOrderByNumber(params.number!);
      await updateOrderStatus(order.id, body, currentUser(req).id);
      await audit(req, `order.status.${body.status.toLowerCase()}`, "Order", order.id, {
        number: order.orderNumber,
        from: order.status,
        to: body.status,
        ...(body.note ? { note: body.note } : {}),
      });
      return ok(await admin.getAdminOrder(order.orderNumber));
    },
  }),
  route({
    method: "post",
    path: "/:number/refund",
    summary: "Refund all or part of the payment",
    description:
      "Card payments are refunded through Stripe (or the demo provider). Cash on Delivery refunds are recorded for staff to pay back. A full refund marks the order Refunded and, if it had not shipped, restocks the items.",
    access: "MANAGER",
    body: refundOrderSchema,
    handler: async ({ req, params, body }) => {
      const result = await refundOrder(params.number!, body, currentUser(req).id);
      const order = await admin.getAdminOrder(params.number!);
      await audit(req, "order.refund", "Order", order.id, {
        number: order.number,
        amount: result.amount,
        full: result.full,
        restocked: result.restocked,
        reason: body.reason,
      });
      return ok({ ...result, order });
    },
  }),
  route({
    method: "get",
    path: "/:number/invoice",
    summary: "Invoice PDF",
    access: "SUPPORT",
    handler: async ({ params, res }) => {
      const order = await admin.findOrderByNumber(params.number!);
      pdf(res, `invoice-${order.orderNumber}.pdf`, await renderInvoice(order, await storeInfo()));
    },
  }),
  route({
    method: "get",
    path: "/:number/packing-slip",
    summary: "Packing slip PDF (no prices; shows the cash to collect for COD)",
    access: "SUPPORT",
    handler: async ({ params, res }) => {
      const order = await admin.findOrderByNumber(params.number!);
      pdf(
        res,
        `packing-slip-${order.orderNumber}.pdf`,
        await renderPackingSlip(order, await storeInfo()),
      );
    },
  }),
]);
