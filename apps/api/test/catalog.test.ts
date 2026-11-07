import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { app, createTestProduct } from "./helpers";

const get = (path: string) => request(app).get(`/api/v1${path}`);

type Card = {
  slug: string;
  price: number;
  colors: { name: string }[];
  sizesInStock: string[];
  inStock: boolean;
  fit: string;
};

describe("GET /products", () => {
  it("returns paginated published products with card fields", async () => {
    // Scoped to a seeded category: other test files create products concurrently.
    const res = await get("/products?category=pullover&limit=3");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 3 });
    expect(res.body.meta.totalPages).toBe(Math.ceil(res.body.meta.total / 3));

    const card = res.body.data[0];
    expect(card).toEqual(
      expect.objectContaining({
        slug: expect.any(String),
        price: expect.any(Number),
        image: expect.objectContaining({ url: expect.any(String) }),
        colors: expect.any(Array),
        inStock: expect.any(Boolean),
      }),
    );
    // Raw stock levels are never exposed publicly.
    expect(JSON.stringify(res.body)).not.toMatch(/"stock"|"reserved"/);
  });

  it("never lists draft or archived products", async () => {
    const draft = await createTestProduct({ status: "DRAFT" });
    const res = await get(`/products?q=${draft.title}`);
    expect(res.body.data).toHaveLength(0);
    // the seeded draft hoodie too
    const all = await get("/products?limit=100");
    expect(all.body.data.map((p: Card) => p.slug)).not.toContain("varsity-embroidered-hoodie");
  });

  it("filters by category (including the seeded catalogue)", async () => {
    const res = await get("/products?category=zip-up&limit=50");
    const slugs = res.body.data.map((p: Card) => p.slug).sort();
    expect(slugs).toEqual(["essential-zip-up-hoodie", "sherpa-lined-zip-hoodie"]);
  });

  it("filters by collection and fit", async () => {
    const res = await get("/products?collection=new-arrivals&fit=OVERSIZED&limit=50");
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const p of res.body.data as Card[]) expect(p.fit).toBe("OVERSIZED");
  });

  it("filters by size and colour on the same variant", async () => {
    const res = await get("/products?size=XS&color=Lilac&limit=50");
    expect(res.body.data.map((p: Card) => p.slug)).toEqual(["cropped-boxy-hoodie"]);
  });

  it("filters by price range (minor units)", async () => {
    const res = await get("/products?minPrice=400000&maxPrice=500000&limit=50");
    expect(res.body.data.length).toBeGreaterThan(0);
    const products = await prisma.product.findMany({
      where: { slug: { in: res.body.data.map((p: Card) => p.slug) } },
      select: { basePrice: true },
    });
    for (const p of products) {
      expect(p.basePrice).toBeGreaterThanOrEqual(400000);
      expect(p.basePrice).toBeLessThanOrEqual(500000);
    }
  });

  it("inStock=true excludes products whose only matching variants are sold out", async () => {
    const product = await createTestProduct({ stock: 0 });
    const res = await get(`/products?q=${encodeURIComponent(product.title)}&inStock=true`);
    expect(res.body.data).toHaveLength(0);
    const without = await get(`/products?q=${encodeURIComponent(product.title)}`);
    expect(without.body.data[0]).toMatchObject({ inStock: false, sizesInStock: [] });
  });

  it("treats reserved units as unavailable", async () => {
    const product = await createTestProduct({ stock: 2 });
    await prisma.productVariant.updateMany({
      where: { productId: product.id },
      data: { reserved: 2 },
    });
    const res = await get(`/products?q=${encodeURIComponent(product.title)}&inStock=true`);
    expect(res.body.data).toHaveLength(0);
  });

  it("searches title and description case-insensitively", async () => {
    const res = await get("/products?q=SHERPA");
    expect(res.body.data.map((p: Card) => p.slug)).toContain("sherpa-lined-zip-hoodie");
  });

  it.each([
    ["price_asc", (a: number, b: number) => a <= b],
    ["price_desc", (a: number, b: number) => a >= b],
  ])("sorts by %s", async (sort, inOrder) => {
    const res = await get(`/products?category=pullover&sort=${sort}&limit=50`);
    const prices = res.body.data.map((p: Card) => p.price);
    for (let i = 1; i < prices.length; i++) expect(inOrder(prices[i - 1], prices[i])).toBe(true);
  });

  it("rejects invalid filters with 422", async () => {
    expect((await get("/products?size=HUGE")).status).toBe(422);
    expect((await get("/products?limit=1000")).status).toBe(422);
  });
});

describe("GET /products/:slug", () => {
  it("returns details with sorted variants, images and taxonomy", async () => {
    const res = await get("/products/classic-pullover-hoodie");
    expect(res.status).toBe(200);
    const p = res.body.data;
    expect(p.sizes).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
    expect(p.colors.map((c: { name: string }) => c.name)).toEqual([
      "Jet Black",
      "Heather Grey",
      "Navy",
    ]);
    expect(p.variants).toHaveLength(18);
    expect(p.variants.slice(0, 6).map((v: { size: string }) => v.size)).toEqual(p.sizes);
    expect(p.categories).toEqual([expect.objectContaining({ slug: "pullover" })]);
    expect(p.images.length).toBeGreaterThan(0);
  });

  it("only exposes a count when stock is low", async () => {
    const product = await createTestProduct({ stock: 2 });
    await prisma.productVariant.update({
      where: { id: product.variants[0]!.id },
      data: { stock: 50 },
    });
    await prisma.productVariant.update({
      where: { id: product.variants[1]!.id },
      data: { stock: 0 },
    });

    const res = await get(`/products/${product.slug}`);
    const bySize = Object.fromEntries(
      res.body.data.variants.map((v: { size: string }) => [v.size, v]),
    );
    expect(bySize[product.variants[0]!.size]).toMatchObject({
      stockStatus: "in_stock",
      lowStockCount: null,
    });
    expect(bySize[product.variants[1]!.size]).toMatchObject({
      stockStatus: "out_of_stock",
      lowStockCount: null,
    });
    expect(bySize[product.variants[2]!.size]).toMatchObject({
      stockStatus: "low_stock",
      lowStockCount: 2,
    });
  });

  it("uses variant price overrides and reports a price range", async () => {
    const product = await createTestProduct({ price: 300000 });
    await prisma.productVariant.update({
      where: { id: product.variants[0]!.id },
      data: { price: 350000 },
    });
    const res = await get(`/products/${product.slug}`);
    expect(res.body.data).toMatchObject({ price: 300000, hasPriceRange: true });
  });

  it("returns 404 for drafts and unknown slugs", async () => {
    expect((await get("/products/varsity-embroidered-hoodie")).status).toBe(404);
    expect((await get("/products/does-not-exist")).status).toBe(404);
  });

  it("lists related products without the product itself", async () => {
    const res = await get("/products/classic-pullover-hoodie/related");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.map((p: Card) => p.slug)).not.toContain("classic-pullover-hoodie");
  });
});

describe("categories, collections and filters", () => {
  it("returns the category tree with published product counts", async () => {
    const res = await get("/categories");
    // Other test files add products concurrently, so compare with the database
    // rather than hard-coded numbers. Only ACTIVE products count (the seeded
    // "graphic" category also holds a DRAFT hoodie).
    for (const slug of ["zip-up", "graphic"]) {
      const node = res.body.data.find((c: { slug: string }) => c.slug === slug);
      const [active, all] = await Promise.all([
        prisma.product.count({ where: { status: "ACTIVE", categories: { some: { slug } } } }),
        prisma.product.count({ where: { categories: { some: { slug } } } }),
      ]);
      expect(node.productCount).toBe(active);
      if (slug === "graphic") expect(all).toBeGreaterThan(active);
    }
  });

  it("gets a single category and collection", async () => {
    expect((await get("/categories/oversized")).body.data.slug).toBe("oversized");
    expect((await get("/collections/new-arrivals")).body.data.productCount).toBeGreaterThan(0);
    expect((await get("/categories/nope")).status).toBe(404);
  });

  it("lists only featured collections when asked", async () => {
    const res = await get("/collections?featured=true");
    expect(res.body.data.every((c: { isFeatured: boolean }) => c.isFeatured)).toBe(true);
    expect(res.body.data.map((c: { slug: string }) => c.slug)).not.toContain("winter-essentials");
  });

  it("returns filter options scoped to a category", async () => {
    const res = await get("/filters?category=zip-up");
    expect(res.body.data).toMatchObject({
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      fits: ["REGULAR"],
      price: { min: 399900, max: 599900 },
    });
    expect(res.body.data.colors).toEqual(
      expect.arrayContaining([
        { name: "Chocolate", hex: "#6B4F3A" },
        { name: "Charcoal", hex: "#36454F" },
      ]),
    );
  });
});
