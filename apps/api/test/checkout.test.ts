import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { testOutbox } from "../src/lib/mailer";
import { prisma } from "../src/lib/prisma";
import { expireUnpaidOrders } from "../src/modules/orders/lifecycle";
import {
  app,
  cartWith,
  checkoutBody,
  createCoupon,
  createTestProduct,
  signedInAgent,
  variantRow,
} from "./helpers";

beforeEach(() => {
  testOutbox.length = 0;
});

const pay = (clientSecret: string, cardNumber: string, expiry = "12/30") =>
  request(app)
    .post("/api/v1/payments/demo/confirm")
    .send({ clientSecret, cardNumber, expiry, cvc: "123" });

describe("POST /checkout/quote", () => {
  it("prices delivery by city and adds the COD fee only for Cash on Delivery", async () => {
    const product = await createTestProduct({ price: 300000 });
    const agent = await cartWith([[product.variants[0]!.id, 1]]);

    const lahoreCard = (
      await agent.post("/api/v1/checkout/quote").send({ city: "Lahore", paymentMethod: "STRIPE" })
    ).body.data;
    expect(lahoreCard).toMatchObject({
      zone: "Lahore",
      subtotal: 300000,
      shipping: 15000,
      codFee: 0,
      total: 315000,
      amountToFreeShipping: 200000,
    });
    expect(lahoreCard.paymentOptions).toEqual([
      expect.objectContaining({ method: "STRIPE", available: true, demo: true }),
      expect.objectContaining({ method: "COD", fee: 5000, available: true }),
    ]);

    const quettaCod = (
      await agent.post("/api/v1/checkout/quote").send({ city: "Quetta", paymentMethod: "COD" })
    ).body.data;
    expect(quettaCod).toMatchObject({
      zone: "Rest of Pakistan",
      shipping: 30000,
      codFee: 10000,
      total: 340000,
    });
    expect(quettaCod.shippingOptions.map((o: { id: string }) => o.id)).toEqual(["standard"]); // no express there
  });

  it("gives free standard delivery over the threshold", async () => {
    const product = await createTestProduct({ price: 300000 });
    const agent = await cartWith([[product.variants[0]!.id, 2]]);
    const q = (await agent.post("/api/v1/checkout/quote").send({ city: "Lahore" })).body.data;
    // Quotes default to Cash on Delivery, which adds the Lahore COD fee.
    expect(q).toMatchObject({ shipping: 0, codFee: 5000, total: 605000, amountToFreeShipping: 0 });
    expect(q.shippingOptions[0]).toMatchObject({ isFree: true });
  });

  it("returns 400 for an empty cart", async () => {
    expect(
      (await request(app).post("/api/v1/checkout/quote").send({ city: "Lahore" })).status,
    ).toBe(400);
  });
});

describe("coupons", () => {
  it("applies a code to the cart and the quote", async () => {
    const product = await createTestProduct({ price: 300000 });
    const coupon = await createCoupon({ type: "PERCENTAGE", value: 10 });
    const agent = await cartWith([[product.variants[0]!.id, 1]]);

    const cart = (await agent.post("/api/v1/cart/coupon").send({ code: coupon.code.toLowerCase() }))
      .body.data;
    expect(cart).toMatchObject({
      subtotal: 300000,
      total: 270000,
      coupon: { code: coupon.code, discount: 30000, isValid: true },
    });
    const q = (
      await agent.post("/api/v1/checkout/quote").send({ city: "Lahore", paymentMethod: "STRIPE" })
    ).body.data;
    expect(q).toMatchObject({ discount: 30000, total: 285000 });

    expect((await agent.delete("/api/v1/cart/coupon")).body.data.coupon).toBeNull();
  });

  it("explains why a code does not apply", async () => {
    const product = await createTestProduct({ price: 100000 });
    const agent = await cartWith([[product.variants[0]!.id, 1]]);
    const min = await createCoupon({ minOrderAmount: 250000 });
    const expired = await createCoupon({ endsAt: new Date(Date.now() - 1000) });

    const r1 = await agent.post("/api/v1/cart/coupon").send({ code: min.code });
    expect(r1.status).toBe(422);
    expect(r1.body.error.details.fieldErrors.code).toEqual([
      "Spend Rs 2,500 or more to use this code",
    ]);
    expect(
      (await agent.post("/api/v1/cart/coupon").send({ code: expired.code })).body.error.message,
    ).toBe("This code has expired");
    expect(
      (await agent.post("/api/v1/cart/coupon").send({ code: "NOPE123" })).body.error.message,
    ).toBe("This code is not valid");
  });

  it("free-shipping coupons zero standard delivery", async () => {
    const product = await createTestProduct({ price: 300000 });
    const coupon = await createCoupon({ type: "FREE_SHIPPING", value: 0 });
    const agent = await cartWith([[product.variants[0]!.id, 1]]);
    await agent.post("/api/v1/cart/coupon").send({ code: coupon.code });
    const q = (await agent.post("/api/v1/checkout/quote").send({ city: "Karachi" })).body.data;
    expect(q).toMatchObject({ shipping: 0, discount: 0, amountToFreeShipping: null });
  });

  it("counts usage at checkout, enforces per-customer limits by email, and releases on cancel", async () => {
    const product = await createTestProduct({ price: 300000, stock: 10 });
    const coupon = await createCoupon({ maxUsesPerUser: 1 });
    const email = `coupon-${coupon.code}@test.local`.toLowerCase();

    const a = await cartWith([[product.variants[0]!.id, 1]]);
    await a.post("/api/v1/cart/coupon").send({ code: coupon.code });
    const first = await a.post("/api/v1/checkout").send(checkoutBody({ email }));
    expect(first.status).toBe(201);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1);

    const b = await cartWith([[product.variants[0]!.id, 1]]);
    await b.post("/api/v1/cart/coupon").send({ code: coupon.code });
    const second = await b.post("/api/v1/checkout").send(checkoutBody({ email }));
    expect(second.status).toBe(409);
    expect(second.body.error.message).toBe("You have already used this code");

    await request(app).post(
      `/api/v1/orders/${first.body.data.orderNumber}/cancel?token=${first.body.data.accessToken}`,
    );
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(0);
  });
});

describe("Cash on Delivery checkout", () => {
  it("confirms the order, takes stock, clears the cart and emails the customer", async () => {
    const product = await createTestProduct({ price: 300000, stock: 5 });
    const [v1, v2] = product.variants;
    const agent = await cartWith([
      [v1!.id, 2],
      [v2!.id, 1],
    ]);
    const body = checkoutBody({ customerNote: "Please call before delivery" });

    const res = await agent.post("/api/v1/checkout").send(body);
    expect(res.status).toBe(201);
    const result = res.body.data;
    expect(result).toMatchObject({ status: "CONFIRMED", total: 900000 + 0 + 5000, payment: null });
    expect(result.orderNumber).toMatch(/^US-\d{5,}$/);

    expect(await variantRow(v1!.id)).toMatchObject({ stock: 3, reserved: 0 });
    expect(await variantRow(v2!.id)).toMatchObject({ stock: 4, reserved: 0 });
    expect((await agent.get("/api/v1/cart")).body.data.items).toEqual([]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(
      3,
    );

    const order = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: result.orderNumber },
      include: { items: true, history: true, payments: true },
    });
    expect(order).toMatchObject({
      email: body.email,
      customerNote: "Please call before delivery",
      subtotal: 900000,
      shippingTotal: 0,
      codFee: 5000,
    });
    expect(order.items[0]).toMatchObject({ productTitle: product.title, unitPrice: 300000 });
    expect(order.history.map((h) => h.status)).toEqual(["CONFIRMED"]);
    expect(order.payments[0]).toMatchObject({ method: "COD", status: "PENDING", amount: 905000 });

    const mail = testOutbox.find((m) => m.to === body.email);
    expect(mail?.subject).toBe(`Order ${result.orderNumber} confirmed`);
    expect(mail?.text).toContain(`/orders/${result.orderNumber}?token=${result.accessToken}`);
  });

  it("hands out sequential, unique order numbers", async () => {
    const product = await createTestProduct({ stock: 10 });
    const numbers = [];
    for (let i = 0; i < 2; i++) {
      const agent = await cartWith([[product.variants[0]!.id, 1]]);
      numbers.push(
        Number(
          (await agent.post("/api/v1/checkout").send(checkoutBody())).body.data.orderNumber.slice(
            3,
          ),
        ),
      );
    }
    expect(numbers[1]).toBeGreaterThan(numbers[0]!);
  });

  it("saves the address for signed-in customers who ask", async () => {
    const product = await createTestProduct();
    const { agent, user } = await signedInAgent();
    await cartWith([[product.variants[0]!.id, 1]], agent);
    const res = await agent
      .post("/api/v1/checkout")
      .send(checkoutBody({ email: user.email, saveAddress: true }));
    expect(res.status).toBe(201);
    expect(await prisma.address.findFirst({ where: { userId: user.id } })).toMatchObject({
      city: "Lahore",
      isDefault: true,
    });
    expect(
      await prisma.order.findFirst({ where: { orderNumber: res.body.data.orderNumber } }),
    ).toMatchObject({ userId: user.id });
  });
});

describe("card checkout (demo Stripe)", () => {
  it("holds stock until paid, then sells it and confirms the order", async () => {
    const product = await createTestProduct({ price: 300000, stock: 5 });
    const v = product.variants[0]!;
    const agent = await cartWith([[v.id, 2]]);
    const body = checkoutBody({ paymentMethod: "STRIPE" });

    const res = await agent.post("/api/v1/checkout").send(body);
    expect(res.status).toBe(201);
    const { orderNumber, payment } = res.body.data;
    expect(res.body.data.status).toBe("PENDING_PAYMENT");
    expect(payment).toMatchObject({ provider: "demo", publishableKey: null, amount: 600000 });
    expect(await variantRow(v.id)).toMatchObject({ stock: 5, reserved: 2 });
    expect((await agent.get("/api/v1/cart")).body.data.itemCount).toBe(2); // kept until paid
    expect(testOutbox).toHaveLength(0);

    // Declined first…
    const declined = await pay(payment.clientSecret, "4000 0000 0000 0002");
    expect(declined.body.data).toMatchObject({
      status: "failed",
      message: "Your card was declined.",
      orderStatus: "PENDING_PAYMENT",
    });
    expect(await variantRow(v.id)).toMatchObject({ stock: 5, reserved: 2 });

    // …then paid.
    const paid = await pay(payment.clientSecret, "4242 4242 4242 4242");
    expect(paid.body.data).toMatchObject({ status: "succeeded", orderStatus: "PAID" });
    expect(await variantRow(v.id)).toMatchObject({ stock: 3, reserved: 0 });
    expect((await agent.get("/api/v1/cart")).body.data.itemCount).toBe(0);

    const order = await prisma.order.findUniqueOrThrow({
      where: { orderNumber },
      include: { history: true, payments: true },
    });
    expect(order.paidAt).not.toBeNull();
    expect(order.payments[0]?.status).toBe("SUCCEEDED");
    expect(order.history.map((h) => h.note)).toEqual([
      "Order placed, awaiting card payment",
      "Payment failed: Your card was declined.",
      "Payment received",
    ]);
    expect(testOutbox.map((m) => m.subject)).toEqual([`Order ${orderNumber} confirmed`]);
  });

  it("rejects real-looking card numbers in demo mode", async () => {
    const product = await createTestProduct();
    const agent = await cartWith([[product.variants[0]!.id, 1]]);
    const { payment } = (
      await agent.post("/api/v1/checkout").send(checkoutBody({ paymentMethod: "STRIPE" }))
    ).body.data;
    const res = await pay(payment.clientSecret, "4111 1111 1111 1111");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/only accepts Stripe test cards/);
  });

  it("rejects a forged payment session", async () => {
    const res = await pay("pi_demo_abc_secret_forged", "4242424242424242");
    expect(res.status).toBe(400);
  });

  it("treats an expired card as declined", async () => {
    const product = await createTestProduct();
    const agent = await cartWith([[product.variants[0]!.id, 1]]);
    const { payment } = (
      await agent.post("/api/v1/checkout").send(checkoutBody({ paymentMethod: "STRIPE" }))
    ).body.data;
    expect((await pay(payment.clientSecret, "4242424242424242", "01/20")).body.data.message).toBe(
      "Your card has expired.",
    );
  });

  it("releases held stock when the payment window expires", async () => {
    const product = await createTestProduct({ stock: 3 });
    const v = product.variants[0]!;
    const agent = await cartWith([[v.id, 2]]);
    const { orderNumber, payment } = (
      await agent.post("/api/v1/checkout").send(checkoutBody({ paymentMethod: "STRIPE" }))
    ).body.data;
    expect(await variantRow(v.id)).toMatchObject({ reserved: 2 });

    await prisma.order.update({
      where: { orderNumber },
      data: { reservedUntil: new Date(Date.now() - 1000) },
    });
    expect(await expireUnpaidOrders()).toBeGreaterThanOrEqual(1);

    expect(await prisma.order.findUniqueOrThrow({ where: { orderNumber } })).toMatchObject({
      status: "CANCELLED",
    });
    expect(await variantRow(v.id)).toMatchObject({ stock: 3, reserved: 0 });

    // Paying after expiry still works while stock is available.
    const late = await pay(payment.clientSecret, "4242424242424242");
    expect(late.body.data.status).toBe("succeeded");
    expect(await variantRow(v.id)).toMatchObject({ stock: 1, reserved: 0 });
  });

  it("starting a new checkout from the same cart cancels the earlier unpaid one", async () => {
    const product = await createTestProduct({ stock: 3 });
    const v = product.variants[0]!;
    const agent = await cartWith([[v.id, 2]]);
    const first = (
      await agent.post("/api/v1/checkout").send(checkoutBody({ paymentMethod: "STRIPE" }))
    ).body.data;
    const second = await agent
      .post("/api/v1/checkout")
      .send(checkoutBody({ paymentMethod: "STRIPE" }));
    expect(second.status).toBe(201);
    expect(
      await prisma.order.findUniqueOrThrow({ where: { orderNumber: first.orderNumber } }),
    ).toMatchObject({ status: "CANCELLED" });
    expect(await variantRow(v.id)).toMatchObject({ reserved: 2 }); // only the new order holds stock
  });
});

describe("stock safety", () => {
  it("rolls back the whole order when one line is short", async () => {
    const product = await createTestProduct({ stock: 5 });
    const [a, b] = product.variants;
    const agent = await cartWith([
      [a!.id, 2],
      [b!.id, 2],
    ]);
    await prisma.productVariant.update({ where: { id: b!.id }, data: { stock: 1 } }); // sold elsewhere

    const res = await agent.post("/api/v1/checkout").send(checkoutBody());
    expect(res.status).toBe(409);
    expect(await variantRow(a!.id)).toMatchObject({ stock: 5, reserved: 0 }); // untouched
    expect(await prisma.order.count({ where: { items: { some: { variantId: a!.id } } } })).toBe(0);
  });

  it("never oversells the last unit to concurrent shoppers", async () => {
    const product = await createTestProduct({ stock: 1 });
    const v = product.variants[0]!;
    const shoppers = await Promise.all(Array.from({ length: 5 }, () => cartWith([[v.id, 1]])));

    const results = await Promise.all(
      shoppers.map((s, i) =>
        s.post("/api/v1/checkout").send(checkoutBody({ paymentMethod: i % 2 ? "COD" : "STRIPE" })),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(
      results.filter((r) => r.status === 409).every((r) => r.body.error.code === "OUT_OF_STOCK"),
    ).toBe(true);
    const row = await variantRow(v.id);
    expect(row.stock - row.reserved).toBe(0);
    expect(row.stock).toBeGreaterThanOrEqual(0);
  });

  it("returns the same order when the same checkout is submitted twice", async () => {
    const product = await createTestProduct({ stock: 5 });
    const agent = await cartWith([[product.variants[0]!.id, 1]]);
    const body = checkoutBody({ paymentMethod: "STRIPE" });
    // A double click: both requests race, and both get the same order back.
    const [r1, r2] = await Promise.all([
      agent.post("/api/v1/checkout").send(body),
      agent.post("/api/v1/checkout").send(body),
    ]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(r2.body.data.orderNumber).toBe(r1.body.data.orderNumber);
    // A later retry (e.g. after a network error) too, with the same order link.
    const again = await agent.post("/api/v1/checkout").send(body);
    expect(again.body.data.orderNumber).toBe(r1.body.data.orderNumber);
    expect(again.body.data.accessToken).toBe(r1.body.data.accessToken);
    expect(await variantRow(product.variants[0]!.id)).toMatchObject({ reserved: 1 });
    expect(await prisma.order.count({ where: { idempotencyKey: body.idempotencyKey } })).toBe(1);
  });

  it("refuses checkout when the cart has problems", async () => {
    const product = await createTestProduct({ stock: 5 });
    const agent = await cartWith([[product.variants[0]!.id, 4]]);
    await prisma.productVariant.update({
      where: { id: product.variants[0]!.id },
      data: { stock: 2 },
    });
    const res = await agent.post("/api/v1/checkout").send(checkoutBody());
    expect(res.status).toBe(409);
    expect(res.body.error.details.warnings[0]).toMatch(/Only 2 left/);
  });
});
