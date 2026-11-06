import { MAX_QTY_PER_ITEM } from "@hoodie/validation";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  app,
  cookieValue,
  createTestProduct,
  createUser,
  PASSWORD,
  signedInAgent,
} from "./helpers";

describe("guest cart", () => {
  it("returns an empty cart before anything is added", async () => {
    const res = await request(app).get("/api/v1/cart");
    expect(res.body.data).toMatchObject({ id: null, items: [], itemCount: 0, subtotal: 0 });
  });

  it("creates a cart with an httpOnly cookie on first add", async () => {
    const product = await createTestProduct({ price: 300000 });
    const res = await request(app)
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 2 });

    expect(res.status).toBe(200);
    expect(cookieValue(res, "cart_token")).toBeTruthy();
    expect((res.headers["set-cookie"] as unknown as string[]).join()).toMatch(
      /cart_token=.+HttpOnly/,
    );
    expect(res.body.data).toMatchObject({ itemCount: 2, subtotal: 600000, warnings: [] });
    expect(res.body.data.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: 300000,
      lineTotal: 600000,
      size: product.variants[0]!.size,
    });
  });

  it("adds to the existing quantity and keeps the cart across requests", async () => {
    const product = await createTestProduct();
    const agent = request.agent(app);
    await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 1 });
    await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 2 });
    await agent.post("/api/v1/cart/items").send({ variantId: product.variants[1]!.id });

    const res = await agent.get("/api/v1/cart");
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.itemCount).toBe(4);
  });

  it("uses the variant's price override", async () => {
    const product = await createTestProduct({ price: 300000 });
    await prisma.productVariant.update({
      where: { id: product.variants[0]!.id },
      data: { price: 320000 },
    });
    const res = await request(app)
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id });
    expect(res.body.data.subtotal).toBe(320000);
  });
});

describe("stock rules", () => {
  it("rejects more than is available, counting what is already in the cart", async () => {
    const product = await createTestProduct({ stock: 3 });
    const agent = request.agent(app);
    await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 2 });

    const res = await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "OUT_OF_STOCK",
      message: "Only 3 available",
      details: { available: 3 },
    });
  });

  it("rejects sold-out variants and counts reserved units as sold", async () => {
    const product = await createTestProduct({ stock: 2 });
    await prisma.productVariant.update({
      where: { id: product.variants[0]!.id },
      data: { reserved: 2 },
    });
    const res = await request(app)
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("This item is sold out");
  });

  it(`caps each line at ${MAX_QTY_PER_ITEM} even with plenty of stock`, async () => {
    const product = await createTestProduct({ stock: 100 });
    const agent = request.agent(app);
    await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: MAX_QTY_PER_ITEM });
    const res = await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 1 });
    expect(res.status).toBe(409);
  });

  it("returns 404 for draft products and inactive variants", async () => {
    const draft = await createTestProduct({ status: "DRAFT" });
    expect(
      (await request(app).post("/api/v1/cart/items").send({ variantId: draft.variants[0]!.id }))
        .status,
    ).toBe(404);

    const product = await createTestProduct();
    await prisma.productVariant.update({
      where: { id: product.variants[0]!.id },
      data: { isActive: false },
    });
    expect(
      (await request(app).post("/api/v1/cart/items").send({ variantId: product.variants[0]!.id }))
        .status,
    ).toBe(404);
  });

  it("warns (instead of failing) when stock drops after an item was added", async () => {
    const product = await createTestProduct({ stock: 5 });
    const agent = request.agent(app);
    await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 4 });
    await prisma.productVariant.update({
      where: { id: product.variants[0]!.id },
      data: { stock: 1 },
    });

    const res = await agent.get("/api/v1/cart");
    expect(res.body.data.items[0]).toMatchObject({ quantity: 4, maxQuantity: 1 });
    expect(res.body.data.warnings).toEqual([expect.stringMatching(/^Only 1 left of Test Hoodie/)]);
  });

  it("excludes unpublished products from the subtotal and flags them", async () => {
    const product = await createTestProduct({ price: 300000 });
    const agent = request.agent(app);
    await agent.post("/api/v1/cart/items").send({ variantId: product.variants[0]!.id });
    await prisma.product.update({ where: { id: product.id }, data: { status: "DRAFT" } });

    const res = await agent.get("/api/v1/cart");
    expect(res.body.data.subtotal).toBe(0);
    expect(res.body.data.items[0].isAvailable).toBe(false);
    expect(res.body.data.warnings[0]).toMatch(/no longer available/);
  });
});

describe("update and remove", () => {
  it("changes quantity, removes items and clears the cart", async () => {
    const product = await createTestProduct();
    const agent = request.agent(app);
    const added = await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id });
    await agent.post("/api/v1/cart/items").send({ variantId: product.variants[1]!.id });
    const itemId = added.body.data.items[0].id;

    expect(
      (await agent.patch(`/api/v1/cart/items/${itemId}`).send({ quantity: 3 })).body.data.itemCount,
    ).toBe(4);
    expect((await agent.delete(`/api/v1/cart/items/${itemId}`)).body.data.itemCount).toBe(1);
    expect((await agent.delete("/api/v1/cart")).body.data.items).toEqual([]);
  });

  it("always allows lowering a quantity, even above current stock", async () => {
    const product = await createTestProduct({ stock: 5 });
    const agent = request.agent(app);
    const added = await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 5 });
    await prisma.productVariant.update({
      where: { id: product.variants[0]!.id },
      data: { stock: 1 },
    });

    const res = await agent
      .patch(`/api/v1/cart/items/${added.body.data.items[0].id}`)
      .send({ quantity: 3 });
    expect(res.status).toBe(200);
  });

  it("cannot touch another cart's items", async () => {
    const product = await createTestProduct();
    const owner = request.agent(app);
    const added = await owner
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id });
    const itemId = added.body.data.items[0].id;

    const stranger = request.agent(app);
    await stranger.post("/api/v1/cart/items").send({ variantId: product.variants[1]!.id });
    expect(
      (await stranger.patch(`/api/v1/cart/items/${itemId}`).send({ quantity: 2 })).status,
    ).toBe(404);
    expect((await stranger.delete(`/api/v1/cart/items/${itemId}`)).status).toBe(404);
  });
});

describe("signed-in cart", () => {
  it("answers 401 TOKEN_EXPIRED for an expired token instead of silently using a guest cart", async () => {
    const { SignJWT } = await import("jose");
    const user = await createUser();
    const expired = await new SignJWT({ role: "CUSTOMER" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer("hoodie-api")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));

    const res = await request(app).get("/api/v1/cart").set("Cookie", `access_token=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.details.reason).toBe("TOKEN_EXPIRED");
  });

  it("keeps the access cookie for the whole session so expiry is detectable", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const access = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
      c.startsWith("access_token="),
    )!;
    expect(Number(access.match(/Max-Age=(\d+)/)![1])).toBeGreaterThan(24 * 60 * 60);
  });

  it("is stored against the user and follows them to another device", async () => {
    const product = await createTestProduct();
    const { agent, user } = await signedInAgent();
    await agent.post("/api/v1/cart/items").send({ variantId: product.variants[0]!.id });

    const otherDevice = request.agent(app);
    await otherDevice.post("/api/v1/auth/login").send({ email: user.email, password: PASSWORD });
    expect((await otherDevice.get("/api/v1/cart")).body.data.itemCount).toBe(1);
  });

  it("merges the guest cart on login, adding quantities and capping at stock", async () => {
    const product = await createTestProduct({ stock: 4 });
    const [a, b] = product.variants;
    const user = await createUser();

    // Signed-in cart already has 3 of A.
    const device1 = request.agent(app);
    await device1.post("/api/v1/auth/login").send({ email: user.email, password: PASSWORD });
    await device1.post("/api/v1/cart/items").send({ variantId: a!.id, quantity: 3 });

    // As a guest on another device: 2 of A and 1 of B.
    const device2 = request.agent(app);
    await device2.post("/api/v1/cart/items").send({ variantId: a!.id, quantity: 2 });
    await device2.post("/api/v1/cart/items").send({ variantId: b!.id, quantity: 1 });

    const login = await device2
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });
    expect(cookieValue(login, "cart_token")).toBe(""); // guest cookie cleared

    const cart = (await device2.get("/api/v1/cart")).body.data;
    const qty = Object.fromEntries(
      cart.items.map((i: { variantId: string; quantity: number }) => [i.variantId, i.quantity]),
    );
    expect(qty).toEqual({ [a!.id]: 4, [b!.id]: 1 }); // 3 + 2 capped at the 4 in stock
  });

  it("merges into a brand-new account on register", async () => {
    const product = await createTestProduct();
    const agent = request.agent(app);
    await agent
      .post("/api/v1/cart/items")
      .send({ variantId: product.variants[0]!.id, quantity: 2 });
    await agent
      .post("/api/v1/auth/register")
      .send({ name: "New Buyer", email: `buyer-${product.id}@test.local`, password: PASSWORD });

    expect((await agent.get("/api/v1/cart")).body.data.itemCount).toBe(2);
  });
});
