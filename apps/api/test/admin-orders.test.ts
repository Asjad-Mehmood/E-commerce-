import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testOutbox } from "../src/lib/mailer";
import { prisma } from "../src/lib/prisma";
import { DemoProvider, setPaymentProviderForTests } from "../src/modules/payments";
import { app, placeCodOrder, placePaidCardOrder, signedInAgent, variantRow } from "./helpers";

beforeEach(() => {
  testOutbox.length = 0;
});
afterEach(() => setPaymentProviderForTests(undefined));

const orderRow = (number: string) =>
  prisma.order.findUniqueOrThrow({ where: { orderNumber: number }, include: { payments: true } });

describe("GET /admin/orders", () => {
  it("lists, searches and filters orders for support staff", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const cod = await placeCodOrder();
    const card = await placePaidCardOrder();

    const byEmail = await agent.get(`/api/v1/admin/orders?q=${encodeURIComponent(cod.email)}`);
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data).toHaveLength(1);
    expect(byEmail.body.data[0]).toMatchObject({
      number: cod.number,
      status: "CONFIRMED",
      customerName: "Ali Khan",
      city: "Lahore",
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      itemCount: 1,
      grandTotal: cod.total,
    });

    const byNumber = await agent.get(`/api/v1/admin/orders?q=${card.number.toLowerCase()}`);
    expect(byNumber.body.data.map((o: { number: string }) => o.number)).toEqual([card.number]);

    const paidOnly = await agent.get(
      `/api/v1/admin/orders?status=PAID&paymentMethod=STRIPE&limit=100`,
    );
    const numbers = paidOnly.body.data.map((o: { number: string }) => o.number);
    expect(numbers).toContain(card.number);
    expect(numbers).not.toContain(cod.number);
    expect(paidOnly.body.meta).toMatchObject({ page: 1, limit: 100 });
  });

  it("filters by day range and rejects a reversed range", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const old = await agent.get("/api/v1/admin/orders?from=2000-01-01&to=2000-01-31");
    expect(old.status).toBe(200);
    expect(old.body.data).toEqual([]);
    expect((await agent.get("/api/v1/admin/orders?from=2024-02-01&to=2024-01-01")).status).toBe(
      422,
    );
  });

  it("is staff only", async () => {
    const { agent } = await signedInAgent("CUSTOMER");
    expect((await agent.get("/api/v1/admin/orders")).status).toBe(403);
    expect((await request(app).get("/api/v1/admin/orders")).status).toBe(401);
  });

  it("exports CSV with one row per item and neutralised formulas", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const cod = await placeCodOrder({ qty: 2 });
    await prisma.order.update({
      where: { orderNumber: cod.number },
      data: { trackingNumber: "=HYPERLINK(1)" },
    });
    const res = await agent.get(`/api/v1/admin/orders/export?q=${cod.number}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="orders-/);
    const lines = res.text.trim().split("\r\n");
    expect(lines[0]).toContain("Order,Placed at (UTC),Status");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(cod.number);
    expect(lines[1]).toContain("Cash on Delivery");
    expect(lines[1]).toContain("'=HYPERLINK(1)");
  });
});

describe("order detail, notes and fulfilment", () => {
  it("shows actions and records who moved the order forward", async () => {
    const { agent, user } = await signedInAgent("SUPPORT");
    const cod = await placeCodOrder();

    const detail = await agent.get(`/api/v1/admin/orders/${cod.number}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.actions).toEqual({
      nextStatuses: ["PROCESSING"],
      canCancel: true,
      canRefund: false,
      refundable: 0,
      restockByDefault: true,
      refundMode: null,
    });

    const notes = await agent
      .patch(`/api/v1/admin/orders/${cod.number}`)
      .send({ adminNotes: "Gift wrap please", courier: "TCS" });
    expect(notes.body.data).toMatchObject({ adminNotes: "Gift wrap please", courier: "TCS" });

    await agent.patch(`/api/v1/admin/orders/${cod.number}/status`).send({ status: "PROCESSING" });
    const shipped = await agent
      .patch(`/api/v1/admin/orders/${cod.number}/status`)
      .send({ status: "SHIPPED", trackingNumber: "TCS123" });
    expect(shipped.status).toBe(200);
    expect(shipped.body.data.status).toBe("SHIPPED");
    expect(shipped.body.data.trackingNumber).toBe("TCS123");
    expect(shipped.body.data.timeline.at(-1)).toMatchObject({ status: "SHIPPED", by: user.name });
    expect(shipped.body.data.actions.canCancel).toBe(false);

    const log = await prisma.auditLog.findFirst({
      where: { action: "order.status.shipped", adminId: user.id },
    });
    expect(log?.diff).toMatchObject({ number: cod.number, from: "PROCESSING", to: "SHIPPED" });
  });

  it("serves invoice and packing slip PDFs", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const cod = await placeCodOrder();
    for (const doc of ["invoice", "packing-slip"]) {
      const res = await agent.get(`/api/v1/admin/orders/${cod.number}/${doc}`).buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});

describe("POST /admin/orders/:number/refund", () => {
  it("fully refunds an unshipped card order: Refunded, restocked, emailed", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const card = await placePaidCardOrder({ qty: 2, stock: 5 });
    expect((await variantRow(card.variantId)).stock).toBe(3);

    const detail = await agent.get(`/api/v1/admin/orders/${card.number}`);
    expect(detail.body.data.actions).toMatchObject({
      canCancel: false, // paid card orders are cancelled through a refund
      canRefund: true,
      refundable: card.total,
      refundMode: "card",
      restockByDefault: true,
    });

    const res = await agent
      .post(`/api/v1/admin/orders/${card.number}/refund`)
      .send({ reason: "Customer changed their mind" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      amount: card.total,
      full: true,
      restocked: true,
      providerRef: expect.stringMatching(/^re_demo_/),
    });
    expect(res.body.data.order).toMatchObject({
      status: "REFUNDED",
      refundedTotal: card.total,
      paymentStatus: "REFUNDED",
      actions: expect.objectContaining({ canRefund: false, refundable: 0 }),
    });
    expect(res.body.data.order.refunds).toHaveLength(1);
    expect((await variantRow(card.variantId)).stock).toBe(5);
    expect(testOutbox.map((m) => m.subject)).toContain(`Refund for order ${card.number}`);

    const again = await agent
      .post(`/api/v1/admin/orders/${card.number}/refund`)
      .send({ reason: "Twice" });
    expect(again.status).toBe(409);
  });

  it("refunds partially, then the rest, without restocking unless asked", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const card = await placePaidCardOrder();

    const partial = await agent
      .post(`/api/v1/admin/orders/${card.number}/refund`)
      .send({ amount: 50000, reason: "Late delivery" });
    expect(partial.body.data).toMatchObject({ full: false, restocked: false });
    expect(partial.body.data.order).toMatchObject({
      status: "PAID",
      paymentStatus: "PARTIALLY_REFUNDED",
      refundedTotal: 50000,
    });

    const tooMuch = await agent
      .post(`/api/v1/admin/orders/${card.number}/refund`)
      .send({ amount: card.total, reason: "Oops" });
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body.error.details.fieldErrors.amount[0]).toMatch(/at most/);

    const partialRestock = await agent
      .post(`/api/v1/admin/orders/${card.number}/refund`)
      .send({ amount: 1000, restock: true, reason: "Bad" });
    expect(partialRestock.status).toBe(422);

    const rest = await agent
      .post(`/api/v1/admin/orders/${card.number}/refund`)
      .send({ reason: "Cancelled" });
    expect(rest.body.data).toMatchObject({ amount: card.total - 50000, full: true });
    expect((await orderRow(card.number)).status).toBe("REFUNDED");
  });

  it("lets only one of two simultaneous refunds through", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const card = await placePaidCardOrder();
    const results = await Promise.all(
      [1, 2].map(() =>
        agent.post(`/api/v1/admin/orders/${card.number}/refund`).send({ reason: "Race" }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const order = await orderRow(card.number);
    expect(order.payments[0]!.refundedAmount).toBe(card.total);
    expect(await prisma.refund.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("rolls back when the payment provider refuses", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const card = await placePaidCardOrder();
    const failing = new DemoProvider("x".repeat(32));
    failing.refund = async () => {
      throw new Error("charge_already_refunded");
    };
    setPaymentProviderForTests(failing);

    const res = await agent
      .post(`/api/v1/admin/orders/${card.number}/refund`)
      .send({ reason: "Try" });
    expect(res.status).toBe(502);
    expect(res.body.error.message).toContain("charge_already_refunded");
    const order = await orderRow(card.number);
    expect(order.status).toBe("PAID");
    expect(order.payments[0]).toMatchObject({ status: "SUCCEEDED", refundedAmount: 0 });
    expect(await prisma.refund.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("records Cash on Delivery refunds only after the cash was collected", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const cod = await placeCodOrder();

    const early = await agent
      .post(`/api/v1/admin/orders/${cod.number}/refund`)
      .send({ reason: "Nothing paid" });
    expect(early.status).toBe(409);

    for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
      await agent.patch(`/api/v1/admin/orders/${cod.number}/status`).send({ status });
    }
    const res = await agent
      .post(`/api/v1/admin/orders/${cod.number}/refund`)
      .send({ reason: "Returned in store", restock: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ full: true, restocked: true, providerRef: null });
    expect(res.body.data.order.status).toBe("REFUNDED");
    expect(res.body.data.order.refunds[0]).toMatchObject({ providerRef: null, restocked: true });
    expect((await variantRow(cod.variantId)).stock).toBe(5);
  });

  it("needs a manager", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const card = await placePaidCardOrder();
    const res = await agent
      .post(`/api/v1/admin/orders/${card.number}/refund`)
      .send({ reason: "Support tried" });
    expect(res.status).toBe(403);
  });
});
