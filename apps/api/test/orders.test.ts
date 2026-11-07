import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testOutbox } from "../src/lib/mailer";
import { prisma } from "../src/lib/prisma";
import { setPaymentProviderForTests, StripeProvider } from "../src/modules/payments";
import {
  app,
  cartWith,
  checkoutBody,
  createTestProduct,
  signedInAgent,
  variantRow,
} from "./helpers";

beforeEach(() => {
  testOutbox.length = 0;
});

async function placeCodOrder(stock = 5) {
  const product = await createTestProduct({ price: 300000, stock });
  const agent = await cartWith([[product.variants[0]!.id, 2]]);
  const body = checkoutBody();
  const res = await agent.post("/api/v1/checkout").send(body);
  return {
    ...(res.body.data as { orderNumber: string; accessToken: string }),
    email: body.email as string,
    variantId: product.variants[0]!.id,
  };
}

describe("viewing orders", () => {
  it("shows a guest order with the link token, and 404s without it", async () => {
    const { orderNumber, accessToken } = await placeCodOrder();

    const res = await request(app).get(`/api/v1/orders/${orderNumber}?token=${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      number: orderNumber,
      status: "CONFIRMED",
      paymentMethod: "COD",
      shippingMethod: "Standard delivery",
      canCancel: true,
      canPay: false,
      shippingAddress: expect.objectContaining({ city: "Lahore" }),
    });
    expect(res.body.data.timeline).toEqual([expect.objectContaining({ status: "CONFIRMED" })]);

    expect((await request(app).get(`/api/v1/orders/${orderNumber}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/orders/${orderNumber}?token=wrong`)).status).toBe(404);
  });

  it("lists a signed-in customer's orders and hides them from others", async () => {
    const product = await createTestProduct();
    const { agent, user } = await signedInAgent();
    await cartWith([[product.variants[0]!.id, 1]], agent);
    const { orderNumber } = (
      await agent.post("/api/v1/checkout").send(checkoutBody({ email: user.email }))
    ).body.data;

    const list = await agent.get("/api/v1/me/orders");
    expect(list.body.data).toEqual([
      expect.objectContaining({ number: orderNumber, itemCount: 1, status: "CONFIRMED" }),
    ]);
    expect(list.body.meta).toMatchObject({ total: 1 });
    expect((await agent.get(`/api/v1/orders/${orderNumber}`)).status).toBe(200);

    const { agent: stranger } = await signedInAgent();
    expect((await stranger.get(`/api/v1/orders/${orderNumber}`)).status).toBe(404);
  });

  it("tracks an order by number and email without exposing the address", async () => {
    const { orderNumber, email } = await placeCodOrder();
    const res = await request(app).get(
      `/api/v1/orders/track?number=${orderNumber.toLowerCase()}&email=${email.toUpperCase()}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      number: orderNumber,
      city: "Lahore",
      status: "CONFIRMED",
    });
    expect(JSON.stringify(res.body.data)).not.toMatch(/House 12|0300/);

    const wrong = await request(app).get(
      `/api/v1/orders/track?number=${orderNumber}&email=someone@else.com`,
    );
    expect(wrong.status).toBe(404);
  });

  it("downloads a PDF invoice", async () => {
    const { orderNumber, accessToken } = await placeCodOrder();
    const res = await request(app)
      .get(`/api/v1/orders/${orderNumber}/invoice?token=${accessToken}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain(`invoice-${orderNumber}.pdf`);
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    expect((res.body as Buffer).length).toBeGreaterThan(1000);
  });
});

describe("cancellation", () => {
  it("lets the customer cancel a confirmed COD order and returns the stock", async () => {
    const { orderNumber, accessToken, variantId } = await placeCodOrder(5);
    expect(await variantRow(variantId)).toMatchObject({ stock: 3 });

    const res = await request(app).post(
      `/api/v1/orders/${orderNumber}/cancel?token=${accessToken}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "CANCELLED", canCancel: false });
    expect(await variantRow(variantId)).toMatchObject({ stock: 5, reserved: 0 });
    expect(testOutbox.some((m) => m.subject === `Order ${orderNumber} was cancelled`)).toBe(true);

    expect(
      (await request(app).post(`/api/v1/orders/${orderNumber}/cancel?token=${accessToken}`)).status,
    ).toBe(409);
  });

  it("does not let the customer cancel once the order is being prepared", async () => {
    const { orderNumber, accessToken } = await placeCodOrder();
    const { agent: staff } = await signedInAgent("SUPPORT");
    await staff.patch(`/api/v1/admin/orders/${orderNumber}/status`).send({ status: "PROCESSING" });

    const res = await request(app).post(
      `/api/v1/orders/${orderNumber}/cancel?token=${accessToken}`,
    );
    expect(res.status).toBe(409);
  });
});

describe("fulfilment (admin)", () => {
  it("moves an order through processing, shipped and delivered with customer emails", async () => {
    const { orderNumber, accessToken, email } = await placeCodOrder();
    const { agent: staff } = await signedInAgent("SUPPORT");
    const path = `/api/v1/admin/orders/${orderNumber}/status`;

    expect((await staff.patch(path).send({ status: "SHIPPED" })).status).toBe(409); // must be prepared first
    await staff.patch(path).send({ status: "PROCESSING" });
    const shipped = await staff
      .patch(path)
      .send({ status: "SHIPPED", trackingNumber: "TCS123456", courier: "TCS" });
    expect(shipped.body.data).toMatchObject({
      status: "SHIPPED",
      trackingNumber: "TCS123456",
      courier: "TCS",
    });
    await staff.patch(path).send({ status: "DELIVERED" });

    const order = (await request(app).get(`/api/v1/orders/${orderNumber}?token=${accessToken}`))
      .body.data;
    expect(order.timeline.map((t: { status: string }) => t.status)).toEqual([
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
    ]);
    expect(order.paymentStatus).toBe("SUCCEEDED"); // cash collected on delivery

    const subjects = testOutbox.filter((m) => m.to === email).map((m) => m.subject);
    expect(subjects).toEqual(
      expect.arrayContaining([
        `Order ${orderNumber} has shipped`,
        `Order ${orderNumber} was delivered`,
      ]),
    );
    expect(testOutbox.find((m) => m.subject.includes("shipped"))?.text).toContain("TCS123456");
  });

  it("is limited to staff", async () => {
    const { orderNumber } = await placeCodOrder();
    const { agent: customer } = await signedInAgent();
    expect(
      (
        await customer
          .patch(`/api/v1/admin/orders/${orderNumber}/status`)
          .send({ status: "PROCESSING" })
      ).status,
    ).toBe(403);
  });
});

describe("Stripe webhooks", () => {
  const stripe = new StripeProvider(
    "sk_test_dummy_key_for_tests",
    "pk_test_dummy",
    "whsec_test_secret",
  );

  afterEach(() => setPaymentProviderForTests(undefined));

  async function pendingCardOrder() {
    const product = await createTestProduct({ stock: 5 });
    const agent = await cartWith([[product.variants[0]!.id, 1]]);
    const res = await agent
      .post("/api/v1/checkout")
      .send(checkoutBody({ paymentMethod: "STRIPE" }));
    const intentId = `pi_test_${res.body.data.orderNumber}`;
    // Stand in for the PaymentIntent Stripe would have created.
    await prisma.payment.updateMany({
      where: { order: { orderNumber: res.body.data.orderNumber } },
      data: { providerRef: intentId },
    });
    return { orderNumber: res.body.data.orderNumber as string, intentId };
  }

  const send = (payload: object, signature?: string) => {
    const body = JSON.stringify(payload);
    return request(app)
      .post("/api/v1/payments/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", signature ?? stripe.signTestPayload(body))
      .send(body);
  };

  it("applies a correctly signed payment_intent.succeeded exactly once", async () => {
    const { orderNumber, intentId } = await pendingCardOrder();
    setPaymentProviderForTests(stripe);
    const event = {
      id: `evt_${intentId}`,
      object: "event",
      type: "payment_intent.succeeded",
      data: { object: { id: intentId, object: "payment_intent" } },
    };

    const first = await send(event);
    expect(first.status).toBe(200);
    expect(first.body.data.result).toBe("applied");
    expect(await prisma.order.findUniqueOrThrow({ where: { orderNumber } })).toMatchObject({
      status: "PAID",
    });

    expect((await send(event)).body.data.result).toBe("duplicate");
    expect(testOutbox.filter((m) => m.subject === `Order ${orderNumber} confirmed`)).toHaveLength(
      1,
    );
  });

  it("rejects bad signatures and ignores unrelated events", async () => {
    setPaymentProviderForTests(stripe);
    const event = {
      id: "evt_x",
      object: "event",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_x" } },
    };
    expect((await send(event, "t=1,v1=bad")).status).toBe(400);

    const other = {
      id: "evt_other",
      object: "event",
      type: "customer.created",
      data: { object: { id: "cus_1" } },
    };
    expect((await send(other)).body.data.result).toBe("ignored");
  });

  it("is not available in demo mode", async () => {
    expect((await request(app).post("/api/v1/payments/stripe/webhook").send({})).status).toBe(404);
  });
});
