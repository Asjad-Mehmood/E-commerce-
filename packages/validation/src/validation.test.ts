import { describe, expect, it } from "vitest";
import {
  addressSchema,
  createProductSchema,
  phoneSchema,
  productListQuerySchema,
  registerSchema,
  stockAdjustmentSchema,
  updateCategorySchema,
  updateCollectionSchema,
  updateProductSchema,
  updateVariantSchema,
} from "./index";

const validProduct = {
  title: "Classic Pullover Hoodie",
  description: "Heavyweight 320 GSM brushed fleece hoodie.",
  basePrice: 349900,
  variants: [
    { sku: "CPH-BLK-M", size: "M", color: "Black" },
    { sku: "CPH-BLK-L", size: "L", color: "Black" },
  ],
};

describe("registerSchema", () => {
  it("normalises email and accepts a strong password", () => {
    const r = registerSchema.parse({
      name: "Ali",
      email: " Ali@Example.COM ",
      password: "Hoodie123",
    });
    expect(r.email).toBe("ali@example.com");
  });

  it("rejects weak passwords", () => {
    const r = registerSchema.safeParse({ name: "Ali", email: "a@b.co", password: "password" });
    expect(r.success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it.each(["03001234567", "+923001234567", "0300-123 4567"])("accepts %s", (p) => {
    expect(phoneSchema.safeParse(p).success).toBe(true);
  });
  it("rejects garbage", () => {
    expect(phoneSchema.safeParse("12ab").success).toBe(false);
  });
});

describe("addressSchema", () => {
  it("defaults the country to PK", () => {
    const r = addressSchema.parse({
      fullName: "Ali Khan",
      phone: "03001234567",
      line1: "House 1, Street 2",
      city: "Lahore",
      postalCode: "54000",
    });
    expect(r.country).toBe("PK");
  });
});

describe("createProductSchema", () => {
  it("accepts a valid product and applies defaults", () => {
    const r = createProductSchema.parse(validProduct);
    expect(r.status).toBe("DRAFT");
    expect(r.fit).toBe("REGULAR");
    expect(r.variants[0]?.stock).toBe(0);
  });

  it("rejects float prices (money must be minor units)", () => {
    expect(createProductSchema.safeParse({ ...validProduct, basePrice: 3499.5 }).success).toBe(
      false,
    );
  });

  it("rejects a compare-at price lower than the price", () => {
    const r = createProductSchema.safeParse({ ...validProduct, compareAtPrice: 100 });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate size + colour variants", () => {
    const r = createProductSchema.safeParse({
      ...validProduct,
      variants: [
        { sku: "A", size: "M", color: "Black" },
        { sku: "B", size: "M", color: "black" },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("productListQuerySchema", () => {
  it("parses query-string values", () => {
    const r = productListQuerySchema.parse({
      page: "2",
      size: "M,L",
      inStock: "true",
      minPrice: "100000",
    });
    expect(r).toMatchObject({
      page: 2,
      limit: 20,
      size: ["M", "L"],
      inStock: true,
      minPrice: 100000,
    });
    expect(r.sort).toBe("newest");
  });

  it("rejects unknown sizes", () => {
    expect(productListQuerySchema.safeParse({ size: "M,HUGE" }).success).toBe(false);
  });
});

describe("updateProductSchema", () => {
  it("does not accept variants (they have their own endpoints)", () => {
    const r = updateProductSchema.parse({ title: "New title", variants: [{ sku: "X" }] });
    expect(r).toEqual({ title: "New title" });
  });

  it("allows clearing the compare-at price with null", () => {
    expect(updateProductSchema.parse({ compareAtPrice: null })).toEqual({ compareAtPrice: null });
  });
});

describe("stockAdjustmentSchema", () => {
  it("rejects a zero change", () => {
    expect(stockAdjustmentSchema.safeParse({ change: 0, reason: "restock" }).success).toBe(false);
  });
  it("accepts negative changes for damage", () => {
    expect(stockAdjustmentSchema.parse({ change: -2, reason: "damaged" }).change).toBe(-2);
  });
});

describe("update schemas never inject defaults", () => {
  it.each([
    ["product", updateProductSchema, { title: "Renamed hoodie" }],
    ["variant", updateVariantSchema, { colorHex: "#000000" }],
    ["category", updateCategorySchema, { name: "Renamed" }],
    ["collection", updateCollectionSchema, { name: "Renamed" }],
  ] as const)("%s", (_name, schema, input) => {
    expect(schema.parse(input)).toEqual(input);
  });
});

describe("engagement schemas", async () => {
  const { reviewSchema, returnRequestSchema, unsubscribeSchema } = await import("./engagement");

  it("validates reviews", () => {
    expect(reviewSchema.safeParse({ rating: 5, body: "Lovely and warm hoodie." }).success).toBe(
      true,
    );
    expect(reviewSchema.safeParse({ rating: 6, body: "Lovely and warm hoodie." }).success).toBe(
      false,
    );
    expect(reviewSchema.safeParse({ rating: 4, body: "short" }).success).toBe(false);
    expect(
      reviewSchema.parse({ rating: 3, title: "  ", body: "Fine, a bit thin." }).title,
    ).toBeNull();
  });

  it("validates return requests", () => {
    const item = { orderItemId: "a", quantity: 1 };
    expect(returnRequestSchema.safeParse({ items: [item], reason: "wrong_size" }).success).toBe(
      true,
    );
    expect(returnRequestSchema.safeParse({ items: [], reason: "wrong_size" }).success).toBe(false);
    expect(returnRequestSchema.safeParse({ items: [item], reason: "other" }).success).toBe(false);
    expect(returnRequestSchema.safeParse({ items: [item, item], reason: "damaged" }).success).toBe(
      false,
    );
  });

  it("normalises unsubscribe emails", () => {
    const parsed = unsubscribeSchema.parse({
      type: "cart",
      email: " Ali@Example.com ",
      token: "x".repeat(32),
    });
    expect(parsed.email).toBe("ali@example.com");
  });
});
