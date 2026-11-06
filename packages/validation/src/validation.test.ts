import { describe, expect, it } from "vitest";
import {
  addressSchema,
  createProductSchema,
  phoneSchema,
  productListQuerySchema,
  registerSchema,
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
