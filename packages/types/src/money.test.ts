import { describe, expect, it } from "vitest";
import { discountPercent, formatMoney, toMajor, toMinor } from "./money";
import { compareSizes } from "./catalog";

describe("money", () => {
  it("converts between major and minor units without float drift", () => {
    expect(toMinor(3499.99)).toBe(349999);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMajor(349900)).toBe(3499);
  });

  it("formats whole and fractional amounts", () => {
    expect(formatMoney(349900)).toMatch(/3,499$/);
    expect(formatMoney(349950)).toMatch(/3,499\.50$/);
    expect(formatMoney(2500, "USD", "en-US")).toBe("$25");
  });

  it("computes the discount percentage", () => {
    expect(discountPercent(300000, 400000)).toBe(25);
    expect(discountPercent(400000, 300000)).toBe(0);
    expect(discountPercent(400000, null)).toBe(0);
  });
});

describe("compareSizes", () => {
  it("sorts sizes XS → XXL with unknown sizes last", () => {
    expect(["XL", "S", "ONE", "XS", "M"].sort(compareSizes)).toEqual(["XS", "S", "M", "XL", "ONE"]);
  });
});
