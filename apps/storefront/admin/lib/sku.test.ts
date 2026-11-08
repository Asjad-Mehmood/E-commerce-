import { describe, expect, it } from "vitest";
import { skuPrefixFor } from "./sku";

describe("SKU prefix", () => {
  it("uses the initials plus a short id code", () => {
    expect(skuPrefixFor("Classic Pullover Hoodie", "cmw4vojwg000e7d2p45sg759g")).toBe("CPH-59G");
    expect(skuPrefixFor("  ", "abc")).toBe("HD-ABC");
    expect(skuPrefixFor("Zip-Up (Limited) Hoodie!", "x1")).toMatch(/^[A-Z0-9-]{2,20}$/);
  });
});
