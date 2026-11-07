import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { app, createUser, PASSWORD, signedInAgent } from "./helpers";

describe("role-based access control", () => {
  it("returns 401 for admin routes without a session", async () => {
    expect((await request(app).get("/api/v1/admin/products")).status).toBe(401);
  });

  it("returns 403 for customers on admin routes", async () => {
    const { agent } = await signedInAgent("CUSTOMER");
    const res = await agent.get("/api/v1/admin/products");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for Support staff on Manager routes", async () => {
    const { agent } = await signedInAgent("SUPPORT");
    expect((await agent.get("/api/v1/admin/products")).status).toBe(403);
  });

  it.each(["MANAGER", "SUPER_ADMIN"] as const)("allows %s on Manager routes", async (role) => {
    const { agent } = await signedInAgent(role);
    expect((await agent.get("/api/v1/admin/products")).status).toBe(200);
  });

  it("applies a role change on the next request, without signing out", async () => {
    const { agent, user } = await signedInAgent("MANAGER");
    expect((await agent.get("/api/v1/admin/products")).status).toBe(200);
    const { prisma } = await import("../src/lib/prisma");
    await prisma.user.update({ where: { id: user.id }, data: { role: "CUSTOMER" } });
    expect((await agent.get("/api/v1/admin/products")).status).toBe(403);
  });
});

describe("CSRF origin check", () => {
  it("rejects writes from an origin that is not allowed", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: "a@b.co", password: "x" });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Request origin not allowed");
  });

  it("allows writes from the storefront and admin origins", async () => {
    const user = await createUser();
    for (const origin of ["http://localhost:3000", "http://localhost:3001"]) {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", origin)
        .send({ email: user.email, password: PASSWORD });
      expect(res.status).toBe(200);
    }
  });

  it("does not affect reads", async () => {
    const res = await request(app).get("/api/v1/categories").set("Origin", "https://evil.example");
    expect(res.status).toBe(200);
  });
});

describe("rate limiting", () => {
  it("returns 429 in the standard error format after too many login attempts", async () => {
    const limited = createApp({ rateLimit: { enabled: true, overrides: { login: { limit: 3 } } } });
    const attempt = () =>
      request(limited)
        .post("/api/v1/auth/login")
        .send({ email: "x@test.local", password: "Wrong1234" });

    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["ratelimit-policy"]).toBeDefined();
  });

  it("limits each route separately (login attempts do not block browsing)", async () => {
    const limited = createApp({ rateLimit: { enabled: true, overrides: { login: { limit: 1 } } } });
    await request(limited)
      .post("/api/v1/auth/login")
      .send({ email: "x@test.local", password: "Wrong1234" });
    expect(
      (
        await request(limited)
          .post("/api/v1/auth/login")
          .send({ email: "x@test.local", password: "Wrong1234" })
      ).status,
    ).toBe(429);
    expect((await request(limited).get("/api/v1/categories")).status).toBe(200);
  });
});
