import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { testOutbox } from "../src/lib/mailer";
import { prisma } from "../src/lib/prisma";
import { sign } from "../src/lib/signed";
import { sendCartReminders } from "../src/modules/engagement/abandoned-carts";
import { sendDailyDigest } from "../src/modules/engagement/digest";
import { sendDueReviewRequests, sendReviewRequest } from "../src/modules/reviews/review-request";
import {
  app,
  cartWith,
  createTestProduct,
  createUser,
  deliver,
  placeCodOrder,
  placeOrderAs,
  signedInAgent,
  uniqueEmail,
  variantRow,
} from "./helpers";

beforeEach(() => {
  testOutbox.length = 0;
});

const mailTo = (email: string) => testOutbox.filter((m) => m.to === email);

describe("reviews", () => {
  it("lets customers review delivered products, after moderation", async () => {
    const product = await createTestProduct();
    const { agent, user } = await signedInAgent();
    const { agent: staff } = await signedInAgent("SUPPORT");
    const base = `/api/v1/products/${product.slug}/reviews`;

    // Not before the order arrives.
    expect((await request(app).get(`${base}/eligibility`)).body.data).toMatchObject({
      canReview: false,
      reason: "sign_in",
    });
    const order = await placeOrderAs(agent, user.email, [[product.variants[0]!.id, 1]]);
    expect((await agent.get(`${base}/eligibility`)).body.data.reason).toBe("not_purchased");
    expect(
      (await agent.put(base).send({ rating: 5, body: "Great hoodie, very warm." })).status,
    ).toBe(403);

    await deliver(order.orderNumber, staff);
    expect((await agent.get(`${base}/eligibility`)).body.data.canReview).toBe(true);

    const bad = await agent.put(base).send({ rating: 0, body: "short" });
    expect(bad.status).toBe(422);
    const saved = await agent
      .put(base)
      .send({ rating: 4, title: "Cosy", body: "Warm and soft. Runs a little big." });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ rating: 4, isApproved: false });

    // Pending reviews are not public.
    expect((await request(app).get(base)).body.data).toEqual([]);

    const pending = await staff.get(`/api/v1/admin/reviews?q=${encodeURIComponent(product.title)}`);
    expect(pending.body.data).toHaveLength(1);
    const id = pending.body.data[0].id;
    const approved = await staff
      .patch(`/api/v1/admin/reviews/${id}`)
      .send({ isApproved: true, adminReply: "Thanks! Size down for a closer fit." });
    expect(approved.body.data.isApproved).toBe(true);

    const list = await request(app).get(base);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        rating: 4,
        title: "Cosy",
        author: "Test U.",
        adminReply: "Thanks! Size down for a closer fit.",
      }),
    ]);
    expect(list.body.summary).toMatchObject({ average: 4, count: 1 });
    expect(list.body.summary.distribution).toContainEqual({ rating: 4, count: 1 });
    const card = (await request(app).get(`/api/v1/products/${product.slug}`)).body.data;
    expect(card).toMatchObject({ avgRating: 4, reviewCount: 1 });

    // Editing sends it back to moderation and out of the average.
    await agent.put(base).send({ rating: 2, body: "Changed my mind, it pilled." });
    expect((await request(app).get(base)).body.summary.count).toBe(0);
    expect((await request(app).get(`/api/v1/products/${product.slug}`)).body.data.reviewCount).toBe(
      0,
    );

    expect((await agent.delete(base)).status).toBe(204);
    expect((await agent.get(`${base}/eligibility`)).body.data.review).toBeNull();
  });

  it("is moderated by staff only", async () => {
    const { agent } = await signedInAgent();
    expect((await agent.get("/api/v1/admin/reviews")).status).toBe(403);
  });

  it("asks for a review a week after delivery, only for unreviewed products", async () => {
    const product = await createTestProduct();
    const { agent, user } = await signedInAgent();
    const order = await placeOrderAs(agent, user.email, [[product.variants[0]!.id, 1]]);
    const row = await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } });

    expect(await sendReviewRequest(row.id)).toBe(0); // not delivered yet
    await deliver(order.orderNumber);
    expect(await sendReviewRequest(row.id)).toBe(1);
    const mail = mailTo(user.email).find((m) => m.subject.startsWith("How's your"));
    expect(mail?.text).toContain(`/products/${product.slug}#reviews`);

    await agent.put(`/api/v1/products/${product.slug}/reviews`).send({
      rating: 5,
      body: "Exactly as pictured, love it.",
    });
    expect(await sendReviewRequest(row.id)).toBe(0);
  });

  it("finds orders delivered a week ago and asks each once", async () => {
    const product = await createTestProduct();
    const { agent, user } = await signedInAgent();
    const order = await placeOrderAs(agent, user.email, [[product.variants[0]!.id, 1]]);
    await deliver(order.orderNumber);
    const day = 24 * 60 * 60 * 1000;
    const inEightDays = new Date(Date.now() + 8 * day);
    const asked = () => mailTo(user.email).filter((m) => m.subject.startsWith("How's your")).length;

    await sendDueReviewRequests(new Date(Date.now() + 2 * day));
    expect(asked()).toBe(0); // too soon
    await sendDueReviewRequests(inEightDays);
    expect(asked()).toBe(1);
    await sendDueReviewRequests(inEightDays);
    expect(asked()).toBe(1); // only once
    const row = await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } });
    expect(row.reviewRequestedAt).not.toBeNull();
  });
});

describe("wishlist", () => {
  it("saves, lists and removes products", async () => {
    const product = await createTestProduct();
    const draft = await createTestProduct({ status: "DRAFT" });
    const { agent } = await signedInAgent();

    expect((await request(app).get("/api/v1/me/wishlist")).status).toBe(401);
    expect((await agent.put(`/api/v1/me/wishlist/${product.id}`)).status).toBe(204);
    expect((await agent.put(`/api/v1/me/wishlist/${product.id}`)).status).toBe(204); // idempotent
    expect((await agent.put(`/api/v1/me/wishlist/${draft.id}`)).status).toBe(404);

    expect((await agent.get("/api/v1/me/wishlist/ids")).body.data).toEqual([product.id]);
    const list = await agent.get("/api/v1/me/wishlist");
    expect(list.body.data).toEqual([expect.objectContaining({ slug: product.slug })]);

    expect((await agent.delete(`/api/v1/me/wishlist/${product.id}`)).status).toBe(204);
    expect((await agent.get("/api/v1/me/wishlist/ids")).body.data).toEqual([]);
  });
});

describe("back-in-stock alerts", () => {
  it("emails waiting shoppers once when stock comes back", async () => {
    const product = await createTestProduct({ stock: 0 });
    const variant = product.variants[0]!;
    const email = uniqueEmail("alert");
    await request(app).post("/api/v1/stock-alerts").send({ email, variantId: variant.id });
    const { agent } = await signedInAgent("MANAGER");

    const inv = await agent.get(`/api/v1/admin/inventory?q=${variant.sku}`);
    expect(inv.body.data[0]).toMatchObject({ sku: variant.sku, waiting: 1 });

    await agent
      .post(`/api/v1/admin/variants/${variant.id}/adjust-stock`)
      .send({ change: 3, reason: "restock" });
    expect(mailTo(email)).toEqual([
      expect.objectContaining({ subject: `Back in stock: ${product.title}` }),
    ]);
    expect(
      (await prisma.stockAlert.findFirstOrThrow({ where: { email } })).notifiedAt,
    ).not.toBeNull();

    await agent
      .post(`/api/v1/admin/variants/${variant.id}/adjust-stock`)
      .send({ change: 2, reason: "restock" });
    expect(mailTo(email)).toHaveLength(1);
  });

  it("also fires when a cancelled order puts the last unit back", async () => {
    const product = await createTestProduct({ stock: 1 });
    const variant = product.variants[0]!;
    const shopper = await cartWith([[variant.id, 1]]);
    const order = (
      await shopper.post("/api/v1/checkout").send({
        email: uniqueEmail("buyer"),
        phone: "03001234567",
        shippingAddress: {
          fullName: "Ali Khan",
          phone: "03001234567",
          line1: "House 1",
          city: "Lahore",
          postalCode: "54000",
        },
        shippingMethod: "standard",
        paymentMethod: "COD",
        idempotencyKey: randomUUID(),
      })
    ).body.data;
    const email = uniqueEmail("alert");
    await request(app).post("/api/v1/stock-alerts").send({ email, variantId: variant.id });

    await request(app).post(
      `/api/v1/orders/${order.orderNumber}/cancel?token=${order.accessToken}`,
    );
    expect(mailTo(email)).toHaveLength(1);
  });
});

describe("newsletter and email preferences", () => {
  it("welcomes new subscribers and unsubscribes with the signed link", async () => {
    const email = uniqueEmail("news");
    await request(app).post("/api/v1/newsletter").send({ email });
    const welcome = mailTo(email)[0]!;
    expect(welcome.subject).toBe("You're on the list");
    const link = new URL(/https?:\/\/\S+unsubscribe\S+/.exec(welcome.text)![0]);
    expect(link.searchParams.get("type")).toBe("newsletter");

    await request(app).post("/api/v1/newsletter").send({ email }); // no second welcome
    expect(mailTo(email)).toHaveLength(1);

    const forged = await request(app)
      .post("/api/v1/email-preferences/unsubscribe")
      .send({ type: "newsletter", email, token: "x".repeat(32) });
    expect(forged.status).toBe(400);

    const res = await request(app)
      .post("/api/v1/email-preferences/unsubscribe")
      .send({
        type: "newsletter",
        email,
        token: link.searchParams.get("token"),
      });
    expect(res.status).toBe(204);
    const row = await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
    expect(row.unsubscribedAt).not.toBeNull();

    const { agent } = await signedInAgent("MANAGER");
    const list = await agent.get(`/api/v1/admin/newsletter?status=unsubscribed&q=${email}`);
    expect(list.body.data).toEqual([expect.objectContaining({ email })]);
    expect(list.body.activeCount).toEqual(expect.any(Number));
    const csv = await agent.get(
      `/api/v1/admin/newsletter?status=unsubscribed&q=${email}&format=csv`,
    );
    expect(csv.text).toContain(email);
  });
});

describe("abandoned cart reminders", () => {
  it("sends one after an hour, another after a day, then stops", async () => {
    const product = await createTestProduct();
    const { agent, user } = await signedInAgent();
    await cartWith([[product.variants[0]!.id, 1]], agent);
    const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: user.id } });
    const touched = new Date(Date.now() - 2 * 3600_000);
    await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: touched } });

    const run = async (now: Date) => {
      await sendCartReminders(now);
      await sendCartReminders(now); // second pass drains any backlog from other test runs
    };
    await run(new Date());
    expect(mailTo(user.email).map((m) => m.subject)).toEqual(["You left something in your cart"]);
    const first = mailTo(user.email)[0]!;
    expect(first.text).toContain(product.title);
    expect(first.text).toContain("type=cart");

    await run(new Date());
    expect(mailTo(user.email)).toHaveLength(1);

    await run(new Date(touched.getTime() + 25 * 3600_000));
    expect(mailTo(user.email).map((m) => m.subject)).toContain("Your cart is still waiting");
    await run(new Date(touched.getTime() + 60 * 3600_000));
    expect(mailTo(user.email)).toHaveLength(2);

    // Changing the cart restarts the reminders.
    await cartWith([[product.variants[1]!.id, 1]], agent);
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } })).remindersSent).toBe(0);
  });

  it("respects the unsubscribe link and skips customers who ordered", async () => {
    const product = await createTestProduct();
    const { agent, user } = await signedInAgent();
    await cartWith([[product.variants[0]!.id, 1]], agent);
    await request(app)
      .post("/api/v1/email-preferences/unsubscribe")
      .send({ type: "cart", email: user.email, token: sign("unsubscribe-cart", user.email) });
    await prisma.cart.update({
      where: { userId: user.id },
      data: { updatedAt: new Date(Date.now() - 2 * 3600_000) },
    });
    await sendCartReminders();
    await sendCartReminders();
    expect(mailTo(user.email)).toEqual([]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).cartReminders).toBe(
      false,
    );
  });
});

describe("daily summary", () => {
  it("emails managers yesterday's numbers", async () => {
    const manager = await createUser({ role: "MANAGER" });
    const support = await createUser({ role: "SUPPORT" });
    expect(await sendDailyDigest()).toBeGreaterThan(0);
    const mail = mailTo(manager.email)[0];
    expect(mail?.subject).toMatch(/^Yesterday: Rs/);
    expect(mailTo(support.email)).toEqual([]);
  });
});

describe("search", () => {
  it("is typo-tolerant, ranks title matches first and suggests products", async () => {
    // A made-up word, so products from other test runs can't match it.
    const letters = "bcdfghjklmnpqrstvwxz";
    const word =
      "Q" +
      Array.from({ length: 9 }, () => letters[Math.floor(Math.random() * letters.length)]).join(
        "",
      ) +
      "a";
    const titled = await createTestProduct();
    await prisma.product.update({
      where: { id: titled.id },
      data: { title: `${word} Hoodie`, soldCount: 0 },
    });
    const mentioned = await createTestProduct();
    await prisma.product.update({
      where: { id: mentioned.id },
      data: { description: `Inspired by the ${word} collection.`, soldCount: 999 },
    });

    const exact = await request(app).get(`/api/v1/products?q=${word}&sort=relevance`);
    expect(exact.body.data.map((p: { slug: string }) => p.slug)).toEqual([
      titled.slug,
      mentioned.slug,
    ]);

    const typo = word.slice(0, -2) + word.slice(-1); // drop a letter
    const fuzzy = await request(app).get(`/api/v1/products?q=${typo}&sort=relevance`);
    expect(fuzzy.body.data.map((p: { slug: string }) => p.slug)).toContain(titled.slug);

    const both = await request(app).get(`/api/v1/products?q=${word}%20black&sort=relevance`);
    expect(both.body.data[0].slug).toBe(titled.slug); // colour from the variants

    const suggest = await request(app).get(`/api/v1/search/suggest?q=${word.toLowerCase()}`);
    expect(suggest.body.data.products[0]).toMatchObject({ slug: titled.slug, price: 300000 });
  });

  it("returns specific products in the requested order (recently viewed)", async () => {
    const a = await createTestProduct();
    const b = await createTestProduct();
    const res = await request(app).get(`/api/v1/products?slugs=${b.slug},missing,${a.slug}`);
    expect(res.body.data.map((p: { slug: string }) => p.slug)).toEqual([b.slug, a.slug]);
  });
});

describe("related products", () => {
  it("puts products bought together first", async () => {
    const main = await createTestProduct();
    const partner = await createTestProduct();
    const { agent, user } = await signedInAgent();
    await placeOrderAs(agent, user.email, [
      [main.variants[0]!.id, 1],
      [partner.variants[0]!.id, 1],
    ]);
    const res = await request(app).get(`/api/v1/products/${main.slug}/related`);
    expect(res.body.data[0].slug).toBe(partner.slug);
  });
});

describe("returns", () => {
  async function deliveredOrder() {
    const cod = await placeCodOrder({ qty: 2 });
    const { agent: staff } = await signedInAgent("MANAGER");
    await deliver(cod.number, staff);
    const order = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: cod.number },
      include: { items: true },
    });
    const viewer = await request(app).get(`/api/v1/orders/${cod.number}`);
    expect(viewer.status).toBe(404);
    const token = (await import("../src/modules/orders/order-access")).orderAccessToken(order.id);
    return { ...cod, staff, order, token, item: order.items[0]! };
  }

  it("runs request → approve → receive (restock) → refund", async () => {
    const { number, staff, token, item, variantId, email } = await deliveredOrder();
    const url = `/api/v1/orders/${number}`;

    const view = await request(app).get(`${url}?token=${token}`);
    expect(view.body.data).toMatchObject({ canReturn: true, returns: [] });
    expect(view.body.data.returnBy).toEqual(expect.any(String));

    const tooMany = await request(app)
      .post(`${url}/returns?token=${token}`)
      .send({ items: [{ orderItemId: item.id, quantity: 3 }], reason: "wrong_size" });
    expect(tooMany.status).toBe(422);

    const created = await request(app)
      .post(`${url}/returns?token=${token}`)
      .send({ items: [{ orderItemId: item.id, quantity: 1 }], reason: "wrong_size" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: "RETURN_REQUESTED", canReturn: false });
    expect(created.body.data.returns[0]).toMatchObject({ status: "REQUESTED", itemsValue: 300000 });
    expect(mailTo(email).map((m) => m.subject)).toContain(
      `We got your return request for ${number}`,
    );

    const again = await request(app)
      .post(`${url}/returns?token=${token}`)
      .send({ items: [{ orderItemId: item.id, quantity: 1 }], reason: "wrong_size" });
    expect(again.status).toBe(409);

    const list = await staff.get("/api/v1/admin/returns?status=open&limit=100");
    const id = list.body.data.find((r: { orderNumber: string }) => r.orderNumber === number).id;
    expect(
      (await staff.get("/api/v1/admin/notifications")).body.data.pendingReturns,
    ).toBeGreaterThan(0);

    const approved = await staff.post(`/api/v1/admin/returns/${id}/approve`).send({});
    expect(approved.body.data.status).toBe("APPROVED");
    expect(mailTo(email).map((m) => m.subject)).toContain(`Your return for ${number} is approved`);

    const before = (await variantRow(variantId)).stock;
    const received = await staff
      .post(`/api/v1/admin/returns/${id}/receive`)
      .send({ restock: true });
    expect(received.body.data).toMatchObject({ status: "RECEIVED", restocked: true });
    expect(received.body.data.order.status).toBe("RETURNED");
    expect((await variantRow(variantId)).stock).toBe(before + 1);

    // Cash on Delivery: recorded, not sent anywhere.
    const refunded = await staff.post(`/api/v1/admin/returns/${id}/refund`).send({});
    expect(refunded.status).toBe(200);
    expect(refunded.body.data).toMatchObject({ status: "REFUNDED", refundAmount: 300000 });
    expect(refunded.body.data.refund).toMatchObject({ amount: 300000, full: false });
    expect((await staff.post(`/api/v1/admin/returns/${id}/refund`).send({})).status).toBe(409);

    // The other unit can still be returned later.
    const after = await request(app).get(`${url}?token=${token}`);
    expect(after.body.data).toMatchObject({ status: "RETURNED", canReturn: true });
  });

  it("declines a return and puts the order back to delivered", async () => {
    const { number, staff, token, item } = await deliveredOrder();
    await request(app)
      .post(`/api/v1/orders/${number}/returns?token=${token}`)
      .send({ items: [{ orderItemId: item.id, quantity: 1 }], reason: "changed_mind" });
    const id = (
      await prisma.returnRequest.findFirstOrThrow({ where: { order: { orderNumber: number } } })
    ).id;

    expect((await staff.post(`/api/v1/admin/returns/${id}/reject`).send({ note: "" })).status).toBe(
      422,
    );
    const rejected = await staff
      .post(`/api/v1/admin/returns/${id}/reject`)
      .send({ note: "The tags were removed." });
    expect(rejected.body.data).toMatchObject({
      status: "REJECTED",
      adminNote: "The tags were removed.",
    });
    expect(rejected.body.data.order.status).toBe("DELIVERED");
  });

  it("closes after the return window and needs a reason for 'other'", async () => {
    const { number, token, item, order } = await deliveredOrder();
    const other = await request(app)
      .post(`/api/v1/orders/${number}/returns?token=${token}`)
      .send({ items: [{ orderItemId: item.id, quantity: 1 }], reason: "other" });
    expect(other.status).toBe(422);

    await prisma.order.update({
      where: { id: order.id },
      data: { deliveredAt: new Date(Date.now() - 30 * 24 * 3600_000) },
    });
    const late = await request(app)
      .post(`/api/v1/orders/${number}/returns?token=${token}`)
      .send({ items: [{ orderItemId: item.id, quantity: 1 }], reason: "wrong_size" });
    expect(late.status).toBe(409);
    expect(late.body.error.message).toMatch(/window/);
  });
});
