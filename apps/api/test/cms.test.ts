import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { app, createTestProduct, uniqueEmail } from "./helpers";

describe("content endpoints", () => {
  it("returns the announcement and only currently active banners", async () => {
    const expired = await prisma.banner.create({
      data: {
        title: "Old sale",
        imageUrl: "https://placehold.co/10.png",
        endsAt: new Date(Date.now() - 1000),
      },
    });
    const res = await request(app).get("/api/v1/cms/home");
    expect(res.status).toBe(200);
    expect(res.body.data.announcement).toMatch(/Free shipping/);
    const ids = res.body.data.banners.map((b: { id: string }) => b.id);
    expect(ids).toContain("banner_winter_drop");
    expect(ids).not.toContain(expired.id);
  });

  it("serves published pages and the FAQ", async () => {
    expect((await request(app).get("/api/v1/cms/pages/returns")).body.data.title).toBe(
      "Returns & Exchanges",
    );
    expect((await request(app).get("/api/v1/cms/pages/nope")).status).toBe(404);
    const faq = await request(app).get("/api/v1/cms/faq");
    expect(faq.body.data.length).toBeGreaterThanOrEqual(5);
  });
});

describe("forms", () => {
  it("stores contact messages for the admin inbox", async () => {
    const email = uniqueEmail("contact");
    const res = await request(app)
      .post("/api/v1/contact")
      .send({ name: "Ayesha", email, message: "Do you ship to Quetta?" });
    expect(res.status).toBe(201);
    expect(await prisma.contactMessage.count({ where: { email, status: "NEW" } })).toBe(1);
  });

  it("subscribes to the newsletter idempotently", async () => {
    const email = uniqueEmail("news");
    expect((await request(app).post("/api/v1/newsletter").send({ email })).status).toBe(204);
    expect((await request(app).post("/api/v1/newsletter").send({ email })).status).toBe(204);
    expect(await prisma.newsletterSubscriber.count({ where: { email } })).toBe(1);
  });

  it("records back-in-stock requests once per email and variant", async () => {
    const product = await createTestProduct({ stock: 0 });
    const body = { email: uniqueEmail("alert"), variantId: product.variants[0]!.id };
    expect((await request(app).post("/api/v1/stock-alerts").send(body)).status).toBe(204);
    expect((await request(app).post("/api/v1/stock-alerts").send(body)).status).toBe(204);
    expect(await prisma.stockAlert.count({ where: { variantId: body.variantId } })).toBe(1);
    expect(
      (
        await request(app)
          .post("/api/v1/stock-alerts")
          .send({ ...body, variantId: "nope" })
      ).status,
    ).toBe(404);
  });
});
