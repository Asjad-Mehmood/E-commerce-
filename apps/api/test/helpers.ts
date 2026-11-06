import type { Role } from "@hoodie/types";
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
