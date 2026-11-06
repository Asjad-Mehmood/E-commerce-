import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/v1/health", () => {
  it("reports ok when the database is reachable", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "ok", checks: { database: "up" } });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("sets security headers and hides the framework", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("allows CORS only from configured origins", async () => {
    const allowed = await request(app).get("/api/v1/health").set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const blocked = await request(app).get("/api/v1/health").set("Origin", "https://evil.example");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
