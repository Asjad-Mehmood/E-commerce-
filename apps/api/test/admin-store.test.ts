import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { testOutbox } from "../src/lib/mailer";
import { prisma } from "../src/lib/prisma";
import {
  app,
  cartWith,
  checkoutBody,
  createTestProduct,
  createUser,
  PASSWORD,
  PNG_1PX,
  signedInAgent,
  uniqueEmail,
} from "./helpers";

beforeEach(() => {
  testOutbox.length = 0;
});

const code = () => `T${randomUUID().slice(0, 8).toUpperCase()}`;

describe("coupons", () => {
  it("creates, validates, updates and reports state", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const c = code();

    const created = await agent
      .post("/api/v1/admin/coupons")
      .send({ code: c.toLowerCase(), type: "PERCENTAGE", value: 15, maxUses: 2 });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: c, value: 15, state: "active", usedCount: 0 });

    expect(
      (await agent.post("/api/v1/admin/coupons").send({ code: c, type: "FIXED", value: 100 }))
        .status,
    ).toBe(409);
    const badPct = await agent
      .post("/api/v1/admin/coupons")
      .send({ code: code(), type: "PERCENTAGE", value: 150 });
    expect(badPct.status).toBe(422);

    // type/value are checked together against the stored coupon
    const id = created.body.data.id;
    expect(
      (await agent.patch(`/api/v1/admin/coupons/${id}`).send({ type: "FIXED", value: 0 })).status,
    ).toBe(422);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await agent.patch(`/api/v1/admin/coupons/${id}`).send({ startsAt: future });
    expect(scheduled.body.data.state).toBe("scheduled");
    const backwards = await agent
      .patch(`/api/v1/admin/coupons/${id}`)
      .send({ endsAt: new Date().toISOString() });
    expect(backwards.status).toBe(422);

    const disabled = await agent
      .patch(`/api/v1/admin/coupons/${id}`)
      .send({ isActive: false, startsAt: null });
    expect(disabled.body.data.state).toBe("disabled");

    const list = await agent.get("/api/v1/admin/coupons");
    expect(list.body.data.map((x: { code: string }) => x.code)).toContain(c);

    expect((await agent.delete(`/api/v1/admin/coupons/${id}`)).status).toBe(204);
  });

  it("keeps coupons that were used on orders", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const c = code();
    const { body } = await agent
      .post("/api/v1/admin/coupons")
      .send({ code: c, type: "FREE_SHIPPING", value: 999 });
    expect(body.data.value).toBe(0);

    const product = await createTestProduct();
    const shopper = await cartWith([[product.variants[0]!.id, 1]]);
    await shopper.post("/api/v1/cart/coupon").send({ code: c });
    expect((await shopper.post("/api/v1/checkout").send(checkoutBody())).status).toBe(201);

    const del = await agent.delete(`/api/v1/admin/coupons/${body.data.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.message).toMatch(/Disable it instead/);
  });

  it("is for managers", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    expect((await agent.get("/api/v1/admin/coupons")).status).toBe(403);
  });
});

describe("shipping zones", () => {
  it("creates zones and stops a city belonging to two active zones", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const city = `testville-${randomUUID().slice(0, 6)}`;
    const zone = await agent.post("/api/v1/admin/shipping-zones").send({
      name: "Test zone",
      regions: [city, ` ${city.toUpperCase()} `],
      standardRate: 20000,
      estimatedDays: "2-3",
    });
    expect(zone.status).toBe(201);
    expect(zone.body.data).toMatchObject({ regions: [city], codFee: 0, isActive: true });

    const clash = await agent.post("/api/v1/admin/shipping-zones").send({
      name: "Clash",
      regions: [city],
      standardRate: 1,
      estimatedDays: "1",
    });
    expect(clash.status).toBe(422);
    expect(clash.body.error.details.fieldErrors.regions[0]).toContain("Test zone");

    // An inactive zone may share it; activating it may not.
    const inactive = await agent.post("/api/v1/admin/shipping-zones").send({
      name: "Spare",
      regions: [city],
      standardRate: 1,
      estimatedDays: "1",
      isActive: false,
    });
    expect(inactive.status).toBe(201);
    expect(
      (
        await agent
          .patch(`/api/v1/admin/shipping-zones/${inactive.body.data.id}`)
          .send({ isActive: true })
      ).status,
    ).toBe(422);

    // Checkout prices the city with the new zone.
    const product = await createTestProduct({ price: 300000 });
    const shopper = await cartWith([[product.variants[0]!.id, 1]]);
    const quote = await shopper.post("/api/v1/checkout/quote").send({ city });
    expect(quote.body.data).toMatchObject({ zone: "Test zone", shipping: 20000 });

    for (const id of [zone.body.data.id, inactive.body.data.id]) {
      expect((await agent.delete(`/api/v1/admin/shipping-zones/${id}`)).status).toBe(204);
    }
  });
});

describe("content", () => {
  it("manages banners and shows only active ones on the homepage", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const title = `Banner ${randomUUID().slice(0, 6)}`;
    const created = await agent.post("/api/v1/admin/banners").send({
      title,
      imageUrl: "https://placehold.co/1600x600",
      link: "/shop",
      ctaLabel: "Shop now",
    });
    expect(created.status).toBe(201);
    const home = async () =>
      (await request(app).get("/api/v1/cms/home")).body.data.banners.map(
        (b: { title: string }) => b.title,
      );
    expect(await home()).toContain(title);

    await agent.patch(`/api/v1/admin/banners/${created.body.data.id}`).send({ isActive: false });
    expect(await home()).not.toContain(title);
    expect(
      (await agent.post("/api/v1/admin/banners").send({ title, imageUrl: "x", link: "shop" }))
        .status,
    ).toBe(422);
    expect((await agent.delete(`/api/v1/admin/banners/${created.body.data.id}`)).status).toBe(204);
  });

  it("manages pages but protects the ones the storefront links to", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const slug = `size-help-${randomUUID().slice(0, 6)}`;
    const page = await agent
      .post("/api/v1/admin/pages")
      .send({ slug, title: "Size help", content: "Measure a hoodie you love." });
    expect(page.status).toBe(201);
    expect((await request(app).get(`/api/v1/cms/pages/${slug}`)).status).toBe(200);

    await agent.patch(`/api/v1/admin/pages/${page.body.data.id}`).send({ isPublished: false });
    expect((await request(app).get(`/api/v1/cms/pages/${slug}`)).status).toBe(404);
    expect((await agent.delete(`/api/v1/admin/pages/${page.body.data.id}`)).status).toBe(204);

    const shipping = await prisma.page.findUniqueOrThrow({ where: { slug: "shipping" } });
    expect((await agent.delete(`/api/v1/admin/pages/${shipping.id}`)).status).toBe(409);
    expect(
      (await agent.patch(`/api/v1/admin/pages/${shipping.id}`).send({ slug: "delivery" })).status,
    ).toBe(409);
  });

  it("manages FAQ entries and the announcement bar", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const faq = await agent.post("/api/v1/admin/faq").send({
      question: `Do you ship abroad? ${randomUUID().slice(0, 4)}`,
      answer: "Not yet.",
    });
    expect(faq.status).toBe(201);
    expect((await agent.delete(`/api/v1/admin/faq/${faq.body.data.id}`)).status).toBe(204);

    const original = (await agent.get("/api/v1/admin/announcement")).body.data;
    expect(
      (await agent.put("/api/v1/admin/announcement").send({ enabled: true, text: "" })).status,
    ).toBe(400);
    // Restore whatever was there, so other test files see the seeded text.
    const saved = await agent.put("/api/v1/admin/announcement").send(original);
    expect(saved.body.data).toEqual(original);
  });
});

describe("messages", () => {
  it("lists, replies by email and archives", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    const email = uniqueEmail("contact");
    await request(app)
      .post("/api/v1/contact")
      .send({ name: "Sara", email, subject: "Sizing", message: "Is a medium roomy?" });

    const list = await agent.get(`/api/v1/admin/messages?q=${email}`);
    expect(list.body.data).toEqual([expect.objectContaining({ status: "NEW", subject: "Sizing" })]);
    const id = list.body.data[0].id;

    const reply = await agent
      .post(`/api/v1/admin/messages/${id}/reply`)
      .send({ body: "Yes, it fits relaxed." });
    expect(reply.body.data.status).toBe("REPLIED");
    const mail = testOutbox.find((m) => m.to === email);
    expect(mail?.subject).toBe("Re: Sizing");
    expect(mail?.text).toContain("Yes, it fits relaxed.");

    await agent.patch(`/api/v1/admin/messages/${id}`).send({ status: "ARCHIVED" });
    expect((await agent.get(`/api/v1/admin/messages?q=${email}`)).body.data).toEqual([]);
    expect(
      (await agent.get(`/api/v1/admin/messages?q=${email}&status=ARCHIVED`)).body.data,
    ).toHaveLength(1);
  });
});

describe("staff", () => {
  it("invites a new staff member who sets a password and signs in", async () => {
    const { agent } = await signedInAgent("SUPER_ADMIN");
    const email = uniqueEmail("staff");
    const invited = await agent
      .post("/api/v1/admin/staff")
      .send({ email, name: "New Support", role: "SUPPORT" });
    expect(invited.status).toBe(201);
    expect(invited.body.data).toMatchObject({ role: "SUPPORT", invitePending: true });

    const mail = testOutbox.find((m) => m.to === email)!;
    expect(mail.subject).toContain("invited");
    const token = decodeURIComponent(/set-password\?token=([^\s]+)/.exec(mail.text)![1]!);
    expect(
      (await request(app).post("/api/v1/auth/reset-password").send({ token, password: PASSWORD }))
        .status,
    ).toBe(204);
    const login = await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD });
    expect(login.body.data.user.role).toBe("SUPPORT");

    expect(
      (await agent.post("/api/v1/admin/staff").send({ email, name: "Again", role: "MANAGER" }))
        .status,
    ).toBe(409);
  });

  it("promotes an existing customer without resetting their password", async () => {
    const { agent } = await signedInAgent("SUPER_ADMIN");
    const customer = await createUser();
    const res = await agent
      .post("/api/v1/admin/staff")
      .send({ email: customer.email, name: "Ignored", role: "MANAGER" });
    expect(res.body.data).toMatchObject({ id: customer.id, role: "MANAGER", invitePending: false });
    expect(testOutbox.find((m) => m.to === customer.email)?.text).toContain("/login");
  });

  it("changes roles, deactivates and removes, but never your own access", async () => {
    const { agent, user: me } = await signedInAgent("SUPER_ADMIN");
    const { agent: theirAgent, user: them } = await signedInAgent("MANAGER");

    const promoted = await agent.patch(`/api/v1/admin/staff/${them.id}`).send({ role: "SUPPORT" });
    expect(promoted.body.data.role).toBe("SUPPORT");
    await agent.patch(`/api/v1/admin/staff/${them.id}`).send({ isBlocked: true });
    expect((await theirAgent.get("/api/v1/admin/orders")).status).toBe(403);

    expect(
      (await agent.patch(`/api/v1/admin/staff/${me.id}`).send({ role: "SUPPORT" })).status,
    ).toBe(409);
    expect((await agent.delete(`/api/v1/admin/staff/${me.id}`)).status).toBe(409);

    expect((await agent.delete(`/api/v1/admin/staff/${them.id}`)).status).toBe(204);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: them.id } })).role).toBe("CUSTOMER");

    const { agent: manager } = await signedInAgent("MANAGER");
    expect((await manager.get("/api/v1/admin/staff")).status).toBe(403);
  });
});

describe("settings and audit log", () => {
  it("updates settings, refuses to switch off every payment method, and logs changes", async () => {
    const { agent, user } = await signedInAgent("SUPER_ADMIN");
    const current = await agent.get("/api/v1/admin/settings");
    expect(current.status).toBe(200);
    expect(current.body.data.system).toMatchObject({
      currency: "PKR",
      timeZone: "Asia/Karachi",
      paymentProvider: "demo",
      emailProvider: "log",
      uploads: "local",
    });

    const none = await agent
      .patch("/api/v1/admin/settings")
      .send({ "payments.card.enabled": false, "payments.cod.enabled": false });
    expect(none.status).toBe(422);

    const phone = `+92 300 ${Math.floor(1e6 + Math.random() * 8e6)}`;
    const saved = await agent.patch("/api/v1/admin/settings").send({ "store.phone": phone });
    expect(saved.body.data.settings["store.phone"]).toBe(phone);

    const log = await agent.get(`/api/v1/admin/audit-log?adminId=${user.id}&entity=Setting`);
    expect(log.body.data[0]).toMatchObject({
      action: "settings.update",
      admin: { id: user.id, email: user.email },
      diff: { "store.phone": { to: phone } },
    });
    expect((await agent.get("/api/v1/admin/audit-log/entities")).body.data).toContain("Setting");

    const { agent: manager } = await signedInAgent("MANAGER");
    expect((await manager.get("/api/v1/admin/settings")).status).toBe(403);
    expect((await manager.get("/api/v1/admin/audit-log")).status).toBe(403);
  });
});

describe("local uploads", () => {
  it("stores an image and serves it cross-origin", async () => {
    const { agent } = await signedInAgent("MANAGER");
    expect((await agent.get("/api/v1/admin/uploads/config")).body.data).toEqual({
      provider: "local",
      maxBytes: 5 * 1024 * 1024,
    });

    const res = await agent
      .post("/api/v1/admin/uploads/local?folder=products")
      .set("Content-Type", "image/png")
      .send(PNG_1PX);
    expect(res.status).toBe(201);
    const url = new URL(res.body.data.url);
    expect(url.pathname).toMatch(/^\/uploads\/products\/[\w-]+\.png$/);

    const file = await request(app).get(url.pathname);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("image/png");
    expect(file.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("rejects files that are not images, whatever they claim to be", async () => {
    const { agent } = await signedInAgent("MANAGER");
    const res = await agent
      .post("/api/v1/admin/uploads/local?folder=products")
      .set("Content-Type", "image/png")
      .send(Buffer.from("<script>alert(1)</script>............"));
    expect(res.status).toBe(400);
    expect(
      (
        await agent
          .post("/api/v1/admin/uploads/local?folder=elsewhere")
          .set("Content-Type", "image/png")
          .send(PNG_1PX)
      ).status,
    ).toBe(422);
    const { agent: support } = await signedInAgent("SUPPORT");
    expect(
      (
        await support
          .post("/api/v1/admin/uploads/local?folder=products")
          .set("Content-Type", "image/png")
          .send(PNG_1PX)
      ).status,
    ).toBe(403);
  });
});
