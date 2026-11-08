import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type TestAgent from "supertest/lib/agent";
import { prisma } from "../src/lib/prisma";
import { createTestProduct, signedInAgent } from "./helpers";

let admin: TestAgent;
let adminId: string;

beforeAll(async () => {
  const session = await signedInAgent("MANAGER");
  admin = session.agent;
  adminId = session.user.id;
});

const uid = () => randomUUID().slice(0, 6).toUpperCase();

const newProduct = (overrides: Record<string, unknown> = {}) => ({
  title: `Admin Hoodie ${uid()}`,
  description: "Made by the admin test suite.",
  basePrice: 350000,
  ...overrides,
});

describe("create product", () => {
  it("creates a draft with variants, images and categories, generating a unique slug", async () => {
    const pullover = await prisma.category.findUniqueOrThrow({ where: { slug: "pullover" } });
    const title = `Cloud Fleece Hoodie ${uid()}`;
    const sku = uid();

    const res = await admin.post("/api/v1/admin/products").send(
      newProduct({
        title,
        categoryIds: [pullover.id],
        images: [{ url: "https://res.cloudinary.com/demo/a.jpg", alt: "front", color: "Black" }],
        variants: [
          { sku: `${sku}-M`, size: "M", color: "Black", stock: 4 },
          { sku: `${sku}-L`, size: "L", color: "Black" },
        ],
      }),
    );

    expect(res.status).toBe(201);
    const p = res.body.data;
    expect(p).toMatchObject({ title, status: "DRAFT", fit: "REGULAR", publishedAt: null });
    expect(p.slug).toBe(title.toLowerCase().replace(/ /g, "-"));
    expect(p.categories).toEqual([expect.objectContaining({ slug: "pullover" })]);
    expect(p.variants).toHaveLength(2);
    expect(p.variants.find((v: { size: string }) => v.size === "M")).toMatchObject({
      stock: 4,
      available: 4,
      effectivePrice: 350000,
    });

    // Same title again → different slug.
    const again = await admin.post("/api/v1/admin/products").send(newProduct({ title }));
    expect(again.body.data.slug).toBe(`${p.slug}-2`);

    const log = await prisma.auditLog.findFirst({
      where: { entityId: p.id, action: "product.create" },
    });
    expect(log?.adminId).toBe(adminId);
  });

  it("sets publishedAt when created as active", async () => {
    const res = await admin.post("/api/v1/admin/products").send(newProduct({ status: "ACTIVE" }));
    expect(res.body.data.publishedAt).not.toBeNull();
  });

  it("rejects unknown categories, taken SKUs and taken slugs", async () => {
    expect(
      (await admin.post("/api/v1/admin/products").send(newProduct({ categoryIds: ["nope"] })))
        .status,
    ).toBe(400);

    const sku = await admin
      .post("/api/v1/admin/products")
      .send(newProduct({ variants: [{ sku: "UEP-JET-M", size: "M", color: "Black" }] }));
    expect(sku.status).toBe(409);
    expect(sku.body.error.message).toContain("UEP-JET-M");

    const slug = await admin
      .post("/api/v1/admin/products")
      .send(newProduct({ slug: "urban-essential-pullover-hoodie" }));
    expect(slug.status).toBe(409);
  });
});

describe("update product", () => {
  it("only changes the fields sent (regression: must not reset status, images or categories)", async () => {
    const created = await admin.post("/api/v1/admin/products").send(
      newProduct({
        status: "ACTIVE",
        isFeatured: true,
        categoryIds: [(await prisma.category.findUniqueOrThrow({ where: { slug: "custom" } })).id],
        images: [{ url: "https://res.cloudinary.com/demo/keep.jpg" }],
      }),
    );
    const id = created.body.data.id;

    const res = await admin.patch(`/api/v1/admin/products/${id}`).send({ title: "Renamed Hoodie" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: "Renamed Hoodie",
      status: "ACTIVE",
      isFeatured: true,
    });
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.categories).toHaveLength(1);
  });

  it("replaces images in the order given and can clear the compare-at price", async () => {
    const created = await admin
      .post("/api/v1/admin/products")
      .send(newProduct({ compareAtPrice: 400000 }));
    const id = created.body.data.id;

    const res = await admin.patch(`/api/v1/admin/products/${id}`).send({
      compareAtPrice: null,
      images: [
        { url: "https://res.cloudinary.com/demo/2.jpg" },
        { url: "https://res.cloudinary.com/demo/1.jpg" },
      ],
    });
    expect(res.body.data.compareAtPrice).toBeNull();
    expect(
      res.body.data.images.map((i: { url: string; position: number }) => [
        i.url.slice(-5),
        i.position,
      ]),
    ).toEqual([
      ["2.jpg", 0],
      ["1.jpg", 1],
    ]);
  });

  it("checks compare-at price against the saved price when only one is sent", async () => {
    const created = await admin
      .post("/api/v1/admin/products")
      .send(newProduct({ basePrice: 350000 }));
    const res = await admin
      .patch(`/api/v1/admin/products/${created.body.data.id}`)
      .send({ compareAtPrice: 300000 });
    expect(res.status).toBe(422);
  });

  it("returns 404 for unknown products", async () => {
    expect(
      (await admin.patch("/api/v1/admin/products/nope").send({ title: "Hello there" })).status,
    ).toBe(404);
  });
});

describe("list, archive and bulk actions", () => {
  it("hides archived products unless asked, and searches by SKU", async () => {
    const product = await createTestProduct();
    const sku = product.variants[0]!.sku;

    expect((await admin.get(`/api/v1/admin/products?q=${sku}`)).body.data).toEqual([
      expect.objectContaining({ id: product.id, variantCount: 3, totalStock: 15 }),
    ]);

    expect((await admin.delete(`/api/v1/admin/products/${product.id}`)).status).toBe(204);
    expect((await admin.get(`/api/v1/admin/products?q=${sku}`)).body.data).toEqual([]);
    expect(
      (await admin.get(`/api/v1/admin/products?q=${sku}&status=ARCHIVED`)).body.data,
    ).toHaveLength(1);
  });

  it("filters low-stock products", async () => {
    const low = await createTestProduct({ stock: 2 });
    const res = await admin.get(`/api/v1/admin/products?lowStock=true&q=${low.variants[0]!.sku}`);
    expect(res.body.data).toHaveLength(1);
  });

  it("publishes several products at once", async () => {
    const a = await createTestProduct({ status: "DRAFT" });
    const b = await createTestProduct({ status: "DRAFT" });
    const res = await admin
      .post("/api/v1/admin/products/bulk")
      .send({ ids: [a.id, b.id], action: "publish" });
    expect(res.body.data.updated).toBe(2);
    const rows = await prisma.product.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(rows.every((p) => p.status === "ACTIVE" && p.publishedAt)).toBe(true);
  });
});

describe("variants", () => {
  it("generates the size × colour matrix and skips existing combinations on re-run", async () => {
    const created = await admin.post("/api/v1/admin/products").send(newProduct());
    const id = created.body.data.id;
    const prefix = `G${uid()}`;

    const first = await admin.post(`/api/v1/admin/products/${id}/variants/generate`).send({
      sizes: ["S", "M"],
      colors: [{ name: "Jet Black", hex: "#111111" }],
      skuPrefix: prefix,
      initialStock: 5,
    });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ created: 2, skipped: 0 });
    expect(first.body.data.variants.map((v: { sku: string }) => v.sku).sort()).toEqual([
      `${prefix}-JET-M`,
      `${prefix}-JET-S`,
    ]);

    const second = await admin.post(`/api/v1/admin/products/${id}/variants/generate`).send({
      sizes: ["S", "M"],
      colors: [{ name: "Jet Black" }, { name: "Sand", hex: "#D6C4A8" }],
      skuPrefix: prefix,
    });
    expect(second.body.data).toMatchObject({ created: 2, skipped: 2 });
    expect(second.body.data.variants).toHaveLength(4);
  });

  it("adds, updates and deletes a single variant", async () => {
    const product = await createTestProduct();
    const sku = `V${uid()}`;
    const added = await admin
      .post(`/api/v1/admin/products/${product.id}/variants`)
      .send({ sku, size: "XL", color: "Black" });
    expect(added.status).toBe(201);

    const dup = await admin
      .post(`/api/v1/admin/products/${product.id}/variants`)
      .send({ sku: `${sku}2`, size: "XL", color: "black" });
    expect(dup.status).toBe(409);

    const updated = await admin
      .patch(`/api/v1/admin/variants/${added.body.data.id}`)
      .send({ price: 399900, isActive: false });
    expect(updated.body.data).toMatchObject({
      price: 399900,
      effectivePrice: 399900,
      isActive: false,
      lowStockAt: 5,
    });

    expect((await admin.delete(`/api/v1/admin/variants/${added.body.data.id}`)).status).toBe(204);
  });

  it("does not allow stock to be set directly", async () => {
    const product = await createTestProduct({ stock: 5 });
    const res = await admin
      .patch(`/api/v1/admin/variants/${product.variants[0]!.id}`)
      .send({ stock: 999 });
    expect(res.body.data.stock).toBe(5);
  });
});

describe("stock adjustments", () => {
  it("adjusts stock, records the reason and returns history", async () => {
    const product = await createTestProduct({ stock: 5 });
    const id = product.variants[0]!.id;

    const restock = await admin
      .post(`/api/v1/admin/variants/${id}/adjust-stock`)
      .send({ change: 10, reason: "restock", note: "PO-42" });
    expect(restock.body.data).toMatchObject({ stock: 15, available: 15 });
    await admin
      .post(`/api/v1/admin/variants/${id}/adjust-stock`)
      .send({ change: -2, reason: "damaged" });

    const history = await admin.get(`/api/v1/admin/variants/${id}/stock-history`);
    expect(
      history.body.data.map((h: { change: number; reason: string }) => [h.change, h.reason]),
    ).toEqual([
      [-2, "damaged"],
      [10, "restock"],
    ]);
    expect(history.body.data[0].adminId).toBe(adminId);
  });

  it("refuses to go below zero or below reserved units", async () => {
    const product = await createTestProduct({ stock: 5 });
    const id = product.variants[0]!.id;
    await prisma.productVariant.update({ where: { id }, data: { reserved: 3 } });

    const res = await admin
      .post(`/api/v1/admin/variants/${id}/adjust-stock`)
      .send({ change: -3, reason: "lost" });
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ stock: 5, reserved: 3 });

    const okRes = await admin
      .post(`/api/v1/admin/variants/${id}/adjust-stock`)
      .send({ change: -2, reason: "lost" });
    expect(okRes.body.data).toMatchObject({ stock: 3, reserved: 3, available: 0 });
    expect(await prisma.inventoryAdjustment.count({ where: { variantId: id } })).toBe(1);
  });

  it("stays consistent under concurrent adjustments", async () => {
    const product = await createTestProduct({ stock: 5 });
    const id = product.variants[0]!.id;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        admin
          .post(`/api/v1/admin/variants/${id}/adjust-stock`)
          .send({ change: -1, reason: "correction" }),
      ),
    );
    const succeeded = results.filter((r) => r.status === 200).length;
    expect(succeeded).toBe(5);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stock).toBe(0);
  });
});
