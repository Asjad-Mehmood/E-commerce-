import type { Role } from "@hoodie/types";
import type { Prisma } from "@prisma/client";
import { hash } from "argon2";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

export const app = createApp();

export const PASSWORD = "Hoodie123";
let passwordHash: Promise<string> | undefined;

export const uniqueEmail = (prefix = "user") => `${prefix}-${randomUUID().slice(0, 8)}@test.local`;

/** Creates a user directly in the database (fast; skips the register endpoint). */
export async function createUser(
  opts: { role?: Role; email?: string; isBlocked?: boolean; verified?: boolean } = {},
) {
  passwordHash ??= hash(PASSWORD);
  return prisma.user.create({
    data: {
      email: opts.email ?? uniqueEmail(opts.role?.toLowerCase() ?? "user"),
      name: "Test User",
      role: opts.role ?? "CUSTOMER",
      isBlocked: opts.isBlocked ?? false,
      emailVerified: opts.verified === false ? null : new Date(),
      passwordHash: await passwordHash,
    },
  });
}

/** A supertest agent (keeps cookies) signed in as a new user with the given role. */
export async function signedInAgent(role: Role = "CUSTOMER") {
  const user = await createUser({ role });
  const agent = request.agent(app);
  const res = await agent
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: PASSWORD });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user, accessToken: res.body.data.accessToken as string };
}

/** Value of a Set-Cookie header, e.g. cookieValue(res, "access_token"). */
export function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const match = raw?.find((c) => c.startsWith(`${name}=`));
  return match?.split(";")[0]?.slice(name.length + 1);
}

/** Creates an ACTIVE product with one variant per size, for cart and admin tests. */
export async function createTestProduct(
  opts: { stock?: number; status?: "ACTIVE" | "DRAFT"; price?: number } = {},
) {
  const id = randomUUID().slice(0, 8);
  return prisma.product.create({
    data: {
      title: `Test Hoodie ${id}`,
      slug: `test-hoodie-${id}`,
      description: "A hoodie created by the test suite.",
      basePrice: opts.price ?? 300000,
      status: opts.status ?? "ACTIVE",
      variants: {
        create: ["S", "M", "L"].map((size) => ({
          sku: `T${id}-${size}`.toUpperCase(),
          size,
          color: "Black",
          colorHex: "#111111",
          stock: opts.stock ?? 5,
        })),
      },
    },
    include: { variants: { orderBy: { size: "asc" } } },
  });
}

export const address = {
  fullName: "Ali Khan",
  phone: "03001234567",
  line1: "House 12, Street 4, Gulberg III",
  city: "Lahore",
  postalCode: "54660",
};

/** A valid checkout body; every call gets a fresh idempotency key. */
export const checkoutBody = (overrides: Record<string, unknown> = {}) => ({
  email: uniqueEmail("buyer"),
  phone: "03001234567",
  shippingAddress: address,
  shippingMethod: "standard",
  paymentMethod: "COD",
  idempotencyKey: randomUUID(),
  ...overrides,
});

/** A guest agent with `items` ([variantId, qty]) in its cart. */
export async function cartWith(items: [string, number][], agent = request.agent(app)) {
  for (const [variantId, quantity] of items) {
    const res = await agent.post("/api/v1/cart/items").send({ variantId, quantity });
    if (res.status !== 200) throw new Error(`add to cart failed: ${JSON.stringify(res.body)}`);
  }
  return agent;
}

export async function createCoupon(data: Partial<Prisma.CouponCreateInput> = {}) {
  return prisma.coupon.create({
    data: {
      code: `T${randomUUID().slice(0, 8).toUpperCase()}`,
      type: "PERCENTAGE",
      value: 10,
      ...data,
    },
  });
}

export const variantRow = (id: string) =>
  prisma.productVariant.findUniqueOrThrow({ where: { id } });

/** Places a Cash on Delivery order as a guest. */
export async function placeCodOrder(opts: { qty?: number; stock?: number; price?: number } = {}) {
  const product = await createTestProduct({ stock: opts.stock ?? 5, price: opts.price ?? 300000 });
  const variantId = product.variants[0]!.id;
  const agent = await cartWith([[variantId, opts.qty ?? 1]]);
  const body = checkoutBody();
  const res = await agent.post("/api/v1/checkout").send(body);
  if (res.status !== 201) throw new Error(`checkout failed: ${JSON.stringify(res.body)}`);
  return {
    number: res.body.data.orderNumber as string,
    total: res.body.data.total as number,
    email: body.email as string,
    variantId,
    productId: product.id,
  };
}

/** Places a card order and pays it with a demo test card. */
export async function placePaidCardOrder(opts: { qty?: number; stock?: number } = {}) {
  const product = await createTestProduct({ stock: opts.stock ?? 5, price: 300000 });
  const variantId = product.variants[0]!.id;
  const agent = await cartWith([[variantId, opts.qty ?? 1]]);
  const body = checkoutBody({ paymentMethod: "STRIPE" });
  const res = await agent.post("/api/v1/checkout").send(body);
  if (res.status !== 201) throw new Error(`checkout failed: ${JSON.stringify(res.body)}`);
  const paid = await request(app).post("/api/v1/payments/demo/confirm").send({
    clientSecret: res.body.data.payment.clientSecret,
    cardNumber: "4242424242424242",
    expiry: "12/30",
    cvc: "123",
  });
  if (paid.body.data?.status !== "succeeded")
    throw new Error(`payment failed: ${JSON.stringify(paid.body)}`);
  return {
    number: res.body.data.orderNumber as string,
    total: res.body.data.total as number,
    email: body.email as string,
    variantId,
    productId: product.id,
  };
}

/** A tiny valid PNG (1×1 pixel). */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Moves an order through to DELIVERED with a staff agent. */
export async function deliver(number: string, staff?: request.Agent) {
  const agent = staff ?? (await signedInAgent("SUPPORT")).agent;
  for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
    const res = await agent.patch(`/api/v1/admin/orders/${number}/status`).send({ status });
    if (res.status !== 200) throw new Error(`status ${status} failed: ${JSON.stringify(res.body)}`);
  }
}

/** A Cash on Delivery order placed by a signed-in customer (their cart and email). */
export async function placeOrderAs(agent: request.Agent, email: string, items: [string, number][]) {
  await cartWith(items, agent);
  const res = await agent.post("/api/v1/checkout").send(checkoutBody({ email }));
  if (res.status !== 201) throw new Error(`checkout failed: ${JSON.stringify(res.body)}`);
  return res.body.data as { orderNumber: string; accessToken: string; total: number };
}
