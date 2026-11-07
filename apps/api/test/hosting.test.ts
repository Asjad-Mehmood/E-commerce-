import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { databaseUrl } from "../src/lib/prisma";
import { trustedProxy } from "../src/middleware/trusted-proxy";

const app = createApp();

describe("trusted proxy (storefront and admin on Vercel)", () => {
  const probe = express();
  probe.set("trust proxy", 1);
  probe.use(trustedProxy("proxy-secret-0123456789"));
  probe.get("/", (req, res) => {
    res.json({
      ip: req.ip,
      trustedServer: res.locals.trustedServer ?? false,
      leaked: req.headers["x-proxy-secret"] ?? null,
    });
  });

  it("uses the shopper's IP sent with the right secret", async () => {
    const res = await request(probe)
      .get("/")
      .set("x-proxy-secret", "proxy-secret-0123456789")
      .set("x-client-ip", "203.0.113.9");
    expect(res.body).toEqual({ ip: "203.0.113.9", trustedServer: false, leaked: null });
  });

  it("marks server-side rendering requests (secret, no shopper IP)", async () => {
    const res = await request(probe).get("/").set("x-proxy-secret", "proxy-secret-0123456789");
    expect(res.body.trustedServer).toBe(true);
  });

  it("ignores the headers without the right secret", async () => {
    const res = await request(probe)
      .get("/")
      .set("x-proxy-secret", "wrong")
      .set("x-client-ip", "203.0.113.9");
    expect(res.body.ip).not.toBe("203.0.113.9");
    expect(res.body.trustedServer).toBe(false);
    expect(res.body.leaked).toBeNull();
  });
});

describe("daily cron", () => {
  it("needs the CRON_SECRET", async () => {
    expect((await request(app).get("/api/v1/cron/daily")).status).toBe(401);
    expect(
      (await request(app).get("/api/v1/cron/daily").set("Authorization", "Bearer nope")).status,
    ).toBe(401);
  });

  it("runs every daily job", async () => {
    const res = await request(app)
      .get("/api/v1/cron/daily")
      .set("Authorization", "Bearer test-cron-secret-0123456789");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data)).toEqual([
      "expireOrders",
      "cartReminders",
      "reviewRequests",
      "dailyDigest",
    ]);
    expect(Object.values(res.body.data)).not.toContain("failed");
  });
});

describe("database URL", () => {
  it("adds PgBouncer and wake-up settings for hosted pooled databases", () => {
    const url = new URL(
      databaseUrl("postgresql://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require"),
    );
    expect(url.searchParams.get("pgbouncer")).toBe("true");
    expect(url.searchParams.get("connect_timeout")).toBe("15");
    expect(url.searchParams.get("sslmode")).toBe("require");
  });

  it("leaves a local database alone", () => {
    const local = "postgresql://hoodie:hoodie@localhost:5432/hoodie_store?schema=public";
    expect(databaseUrl(local)).toBe(local);
  });
});
