import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../src/lib/csv";
import { addDays, dayOf, dayRange, startOfDay } from "../src/lib/dates";
import { prisma } from "../src/lib/prisma";
import { periodStarts } from "../src/modules/admin/reports.service";
import {
  createTestProduct,
  createUser,
  placeCodOrder,
  placePaidCardOrder,
  signedInAgent,
} from "./helpers";

describe("store time zone helpers", () => {
  it("converts local days in Karachi (UTC+5) to instants", () => {
    expect(startOfDay("2026-03-10", "Asia/Karachi").toISOString()).toBe("2026-03-09T19:00:00.000Z");
    expect(dayOf(new Date("2026-03-09T19:30:00Z"), "Asia/Karachi")).toBe("2026-03-10");
    expect(dayOf(new Date("2026-03-09T18:59:00Z"), "Asia/Karachi")).toBe("2026-03-09");
  });

  it("handles daylight saving zones", () => {
    // London switches to BST on 29 March 2026.
    expect(startOfDay("2026-03-29", "Europe/London").toISOString()).toBe(
      "2026-03-29T00:00:00.000Z",
    );
    expect(startOfDay("2026-03-30", "Europe/London").toISOString()).toBe(
      "2026-03-29T23:00:00.000Z",
    );
  });

  it("builds inclusive day ranges", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const r = dayRange("Asia/Karachi", undefined, undefined, 7, now);
    expect(r).toMatchObject({ from: "2026-06-09", to: "2026-06-15" });
    expect(r.end.getTime() - r.start.getTime()).toBe(7 * 24 * 3600 * 1000);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("lists report periods by day, ISO week and month", () => {
    expect(periodStarts("2026-01-30", "2026-02-02", "day")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
    expect(periodStarts("2026-01-07", "2026-01-20", "week")).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
    ]);
    expect(periodStarts("2026-01-15", "2026-03-01", "month")).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });
});

describe("CSV", () => {
  it("quotes and neutralises formula cells", () => {
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell(-5)).toBe("-5"); // real numbers stay numbers
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x\ny"]])).toBe('a,b\r\n1,"x\ny"\r\n');
  });
});

/** Inserts a delivered order on a given instant (for deterministic report periods). */
async function orderAt(placedAt: Date, grandTotal: number, refunded = 0) {
  const product = await createTestProduct();
  const variant = product.variants[0]!;
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-${randomUUID().slice(0, 8)}`,
      email: "report@test.local",
      phone: "03001234567",
      shippingAddress: { fullName: "R", city: "Lahore" },
      status: refunded === grandTotal ? "REFUNDED" : "DELIVERED",
      paymentMethod: "COD",
      subtotal: grandTotal - 20000,
      shippingTotal: 15000,
      codFee: 5000,
      grandTotal,
      shippingMethod: "standard",
      placedAt,
      items: {
        create: {
          variantId: variant.id,
          productId: product.id,
          productTitle: product.title,
          productSlug: product.slug,
          size: variant.size,
          color: variant.color,
          sku: variant.sku,
          unitPrice: grandTotal - 20000,
          quantity: 1,
          lineTotal: grandTotal - 20000,
        },
      },
      payments: {
        create: {
          method: "COD",
          status: refunded ? "PARTIALLY_REFUNDED" : "SUCCEEDED",
          amount: grandTotal,
          refundedAmount: refunded,
        },
      },
    },
  });
  return { order, product };
}

describe("reports", () => {
  // A quiet stretch far in the past, so other test files cannot affect the numbers.
  const year = 1990 + Math.floor(Math.random() * 20);
  const day = `${year}-05-14`;

  it("groups net sales by local day, counting refunds against the order", async () => {
    const { agent } = await signedInAgent("MANAGER");
    // 23:30 on the 14th in Karachi is still the 14th locally (18:30 UTC).
    await orderAt(new Date(`${day}T18:30:00Z`), 320000);
    await orderAt(new Date(`${day}T05:00:00Z`), 220000, 50000);

    const res = await agent.get(
      `/api/v1/admin/reports/sales?from=${addDays(day, -1)}&to=${addDays(day, 1)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toEqual([
      expect.objectContaining({ period: addDays(day, -1), orders: 0, net: 0 }),
      {
        period: day,
        orders: 2,
        units: 2,
        gross: 540000,
        discounts: 0,
        shipping: 40000,
        refunds: 50000,
        net: 490000,
      },
      expect.objectContaining({ period: addDays(day, 1), orders: 0 }),
    ]);
    expect(res.body.data.totals).toMatchObject({ orders: 2, net: 490000 });

    const monthly = await agent.get(
      `/api/v1/admin/reports/sales?from=${year}-05-01&to=${year}-06-30&groupBy=month`,
    );
    expect(monthly.body.data.rows.map((r: { period: string }) => r.period)).toEqual([
      `${year}-05-01`,
      `${year}-06-01`,
    ]);
  });

  it("downloads CSV and ranks products", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const { product } = await orderAt(new Date(`${year}-08-03T10:00:00Z`), 520000);

    const csv = await agent.get(
      `/api/v1/admin/reports/sales?from=${year}-08-03&to=${year}-08-03&format=csv`,
    );
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain(`${year}-08-03,1,1,5200.00,0.00,200.00,0.00,5200.00`);

    const products = await agent.get(
      `/api/v1/admin/reports/products?from=${year}-08-03&to=${year}-08-03`,
    );
    expect(products.body.data).toEqual([
      { productId: product.id, title: product.title, orders: 1, units: 1, revenue: 500000 },
    ]);

    const categories = await agent.get(
      `/api/v1/admin/reports/categories?from=${year}-08-03&to=${year}-08-03`,
    );
    expect(categories.body.data).toEqual([
      { categoryId: null, name: "Uncategorised", units: 1, revenue: 500000 },
    ]);

    const valuation = await agent.get("/api/v1/admin/reports/inventory");
    expect(valuation.body.data).toContainEqual({
      productId: product.id,
      title: product.title,
      status: "ACTIVE",
      units: 15,
      retailValue: 15 * 300000,
    });
  });

  it("is for managers", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    expect((await agent.get("/api/v1/admin/reports/sales")).status).toBe(403);
  });
});

describe("dashboard and notifications", () => {
  it("returns KPIs, a filled daily series and the latest orders", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const cod = await placeCodOrder();

    const res = await agent.get("/api/v1/admin/dashboard?days=7");
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.range.days).toBe(7);
    expect(d.series).toHaveLength(7);
    expect(d.series.at(-1).date).toBe(d.range.to);
    expect(d.kpis.orders.value).toBeGreaterThanOrEqual(1);
    expect(d.today.sales).toBeGreaterThanOrEqual(cod.total);
    expect(d.toFulfil).toBeGreaterThanOrEqual(1);
    expect(d.recentOrders.length).toBeGreaterThan(0);
    expect(d.paymentMix.map((m: { method: string }) => m.method)).toContain("COD");

    expect((await agent.get("/api/v1/admin/dashboard?days=12")).status).toBe(422);
  });

  it("feeds the top bar", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const card = await placePaidCardOrder();
    const res = await agent.get("/api/v1/admin/notifications");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      toFulfil: expect.any(Number),
      newMessages: expect.any(Number),
      lowStock: expect.any(Number),
    });
    expect(res.body.data.latestOrder).not.toBeNull();
    expect(res.body.data.toFulfil).toBeGreaterThanOrEqual(1);
    expect(card.number).toMatch(/^HD-/);
  });
});

describe("inventory", () => {
  it("lists variants with low and out-of-stock filters", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const product = await createTestProduct({ stock: 10 });
    const [s, m] = product.variants;
    await prisma.productVariant.update({ where: { id: s!.id }, data: { stock: 0 } });
    await prisma.productVariant.update({ where: { id: m!.id }, data: { stock: 3 } });
    const term = product.title.split(" ").at(-1)!;

    const all = await agent.get(`/api/v1/admin/inventory?q=${term}`);
    expect(all.status).toBe(200);
    expect(all.body.data.map((r: { available: number }) => r.available)).toEqual([0, 3, 10]);

    const low = await agent.get(`/api/v1/admin/inventory?q=${term}&stock=low`);
    expect(low.body.data.map((r: { sku: string }) => r.sku).sort()).toEqual(
      [s!.sku, m!.sku].sort(),
    );
    const out = await agent.get(`/api/v1/admin/inventory?q=${term}&stock=out`);
    expect(out.body.data).toEqual([
      expect.objectContaining({ sku: s!.sku, stock: 0, available: 0, productTitle: product.title }),
    ]);
  });

  it("shows adjustment history with the staff member's name", async () => {
    const { agent, user } = await signedInAgent("MANAGER");
    const product = await createTestProduct({ stock: 2 });
    const variant = product.variants[0]!;
    await agent
      .post(`/api/v1/admin/variants/${variant.id}/adjust-stock`)
      .send({ change: 10, reason: "restock", note: "Delivery from supplier" });
    const res = await agent.get(`/api/v1/admin/inventory/${variant.id}/history`);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        change: 10,
        reason: "restock",
        note: "Delivery from supplier",
        by: user.name,
      }),
    ]);
  });
});

describe("customers", () => {
  it("lists customers with lifetime value and shows their profile", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const customer = await createUser();
    const { order } = await orderAt(new Date(), 400000, 100000);
    await prisma.order.update({ where: { id: order.id }, data: { userId: customer.id } });

    const list = await agent.get(`/api/v1/admin/customers?q=${customer.email}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        id: customer.id,
        email: customer.email,
        orderCount: 1,
        totalSpent: 300000,
        isBlocked: false,
      }),
    ]);

    const detail = await agent.get(`/api/v1/admin/customers/${customer.id}`);
    expect(detail.body.data).toMatchObject({
      averageOrderValue: 300000,
      orders: [expect.objectContaining({ number: order.orderNumber })],
      addresses: [],
    });

    const noted = await agent
      .patch(`/api/v1/admin/customers/${customer.id}`)
      .send({ adminNote: "Prefers evening delivery" });
    expect(noted.body.data.adminNote).toBe("Prefers evening delivery");

    // Staff accounts are not customers.
    const { user: staff } = await signedInAgent("MANAGER");
    expect((await agent.get(`/api/v1/admin/customers/${staff.id}`)).status).toBe(404);
  });

  it("blocks a customer (managers only) and ends their sessions", async () => {
    const { agent: support } = await signedInAgent("SUPPORT");
    const { agent: manager } = await signedInAgent("MANAGER");
    const { agent: customerAgent, user: customer } = await signedInAgent("CUSTOMER");

    expect(
      (
        await support
          .patch(`/api/v1/admin/customers/${customer.id}/block`)
          .send({ isBlocked: true })
      ).status,
    ).toBe(403);

    const res = await manager
      .patch(`/api/v1/admin/customers/${customer.id}/block`)
      .send({ isBlocked: true });
    expect(res.body.data.isBlocked).toBe(true);
    expect((await customerAgent.get("/api/v1/auth/me")).status).toBe(403);
    expect((await customerAgent.post("/api/v1/auth/refresh")).status).not.toBe(200);

    const blockedList = await manager.get(
      `/api/v1/admin/customers?status=blocked&q=${customer.email}`,
    );
    expect(blockedList.body.data).toHaveLength(1);
  });
});
