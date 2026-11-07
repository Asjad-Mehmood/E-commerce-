import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { databaseUrl } from "../src/lib/prisma";
import { handle, request } from "../src/embedded";
import { createUser, PASSWORD, PNG_1PX } from "./helpers";
import {
  INTERNAL_HEADER,
  internalRequest,
  internalRequestToken,
} from "../src/middleware/internal-request";

const app = createApp();

describe("in-process requests (the storefront's server-side rendering)", () => {
  it("answers GETs without HTTP", async () => {
    const res = await request("/health");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe("ok");
  });

  it("returns catalogue data and 404s like the HTTP API", async () => {
    const list = await request("/products?limit=2");
    expect(list.status).toBe(200);
    expect(JSON.parse(list.body).data.length).toBeGreaterThan(0);
    expect((await request("/products/does-not-exist")).status).toBe(404);
  });

  it("skips rate limits only with this process's token", async () => {
    const probe = express();
    probe.use(internalRequest);
    probe.get("/", (req, res) => {
      res.json({
        trusted: res.locals.trustedServer ?? false,
        leaked: req.headers[INTERNAL_HEADER] ?? null,
      });
    });
    const ok = await supertest(probe).get("/").set(INTERNAL_HEADER, internalRequestToken());
    expect(ok.body).toEqual({ trusted: true, leaked: null });
    const forged = await supertest(probe).get("/").set(INTERNAL_HEADER, "guess");
    expect(forged.body).toEqual({ trusted: false, leaked: null });
  });
});

describe("Web Request adapter (the /api/v1 route on Vercel)", () => {
  const site = "http://localhost:3000/api/v1";
  const json = async (res: Response) => (await res.json()) as { data: any; error: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  /** Signs in through the adapter and returns the Cookie header to send back. */
  async function signIn(role: "CUSTOMER" | "MANAGER" = "CUSTOMER") {
    const user = await createUser({ role });
    const res = await handle(
      new Request(`${site}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: user.email, password: PASSWORD }),
      }),
    );
    return {
      res,
      user,
      cookie: res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    };
  }

  it("passes JSON bodies and returns every cookie", async () => {
    const { res, user } = await signIn();
    expect(res.status).toBe(200);
    expect((await json(res)).data.user.email).toBe(user.email);
    expect(res.headers.getSetCookie().length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the CSRF origin check and error format", async () => {
    const res = await handle(
      new Request(`${site}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("FORBIDDEN");
  });

  it("round-trips binary uploads and downloads", async () => {
    const { cookie } = await signIn("MANAGER");
    const upload = await handle(
      new Request(`${site}/admin/uploads/media?folder=products`, {
        method: "POST",
        headers: { "content-type": "image/png", cookie, origin: "http://localhost:3000" },
        body: PNG_1PX,
      }),
    );
    expect(upload.status).toBe(201);
    const path = new URL((await json(upload)).data.url).pathname;
    const image = await handle(new Request(`http://localhost:3000${path}`));
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await image.arrayBuffer()).equals(PNG_1PX)).toBe(true);
    const cached = await handle(
      new Request(`http://localhost:3000${path}`, {
        headers: { "if-none-match": image.headers.get("etag")! },
      }),
    );
    expect(cached.status).toBe(304);
  });
});

describe("daily cron", () => {
  it("needs the CRON_SECRET", async () => {
    expect((await supertest(app).get("/api/v1/cron/daily")).status).toBe(401);
    expect(
      (await supertest(app).get("/api/v1/cron/daily").set("Authorization", "Bearer nope")).status,
    ).toBe(401);
  });

  it("runs every daily job", async () => {
    const res = await supertest(app)
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
