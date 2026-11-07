import { describe, expect, it } from "vitest";
import {
  amountToFreeShipping,
  checkCoupon,
  computeTotals,
  couponDiscount,
  pickZone,
  shippingOptions,
} from "./pricing";

const coupon = {
  isActive: true,
  startsAt: null,
  endsAt: null,
  minOrderAmount: null,
  maxUses: null,
  usedCount: 0,
  maxUsesPerUser: null,
};

const zone = (o: Partial<Parameters<typeof pickZone>[0][number]> = {}) => ({
  name: "Lahore",
  regions: ["lahore"],
  standardRate: 15000,
  expressRate: 30000,
  freeOverAmount: 500000,
  codFee: 5000,
  codEnabled: true,
  estimatedDays: "1-2",
  position: 0,
  isActive: true,
  ...o,
});

describe("checkCoupon", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it.each([
    [{ isActive: false }, "This code is not valid"],
    [{ startsAt: new Date("2026-07-01") }, "This code is not active yet"],
    [{ endsAt: new Date("2026-05-01") }, "This code has expired"],
    [{ maxUses: 5, usedCount: 5 }, "This code has reached its usage limit"],
  ])("rejects %o", (overrides, reason) => {
    expect(checkCoupon({ ...coupon, ...overrides }, { subtotal: 100000, now })).toEqual({
      ok: false,
      reason,
    });
  });

  it("enforces per-customer limits and minimum spend", () => {
    expect(
      checkCoupon({ ...coupon, maxUsesPerUser: 1 }, { subtotal: 1, usesByCustomer: 1 }),
    ).toMatchObject({ ok: false });
    expect(checkCoupon({ ...coupon, minOrderAmount: 250000 }, { subtotal: 249999 })).toEqual({
      ok: false,
      reason: "Spend Rs 2,500 or more to use this code",
    });
    expect(checkCoupon({ ...coupon, minOrderAmount: 250000 }, { subtotal: 250000 })).toEqual({
      ok: true,
    });
  });
});

describe("couponDiscount", () => {
  it("rounds percentage discounts down to whole rupees", () => {
    expect(couponDiscount({ type: "PERCENTAGE", value: 10 }, 379900)).toBe(37900); // not Rs 379.90
    expect(couponDiscount({ type: "PERCENTAGE", value: 10 }, 300000)).toBe(30000);
  });
  it("never discounts more than the subtotal", () => {
    expect(couponDiscount({ type: "FIXED", value: 50000 }, 30000)).toBe(30000);
    expect(couponDiscount({ type: "PERCENTAGE", value: 150 }, 30000)).toBe(30000);
  });
  it("gives no subtotal discount for free shipping", () => {
    expect(couponDiscount({ type: "FREE_SHIPPING", value: 0 }, 30000)).toBe(0);
  });
});

describe("shipping", () => {
  const zones = [
    zone(),
    zone({ name: "Rest", regions: ["*"], position: 2, expressRate: null }),
    zone({ name: "Off", regions: ["karachi"], isActive: false }),
  ];

  it("matches the city case-insensitively and falls back to the * zone", () => {
    expect(pickZone(zones, " LAHORE ")?.name).toBe("Lahore");
    expect(pickZone(zones, "Quetta")?.name).toBe("Rest");
    expect(pickZone(zones, "Karachi")?.name).toBe("Rest"); // inactive zones are skipped
  });

  it("makes standard delivery free over the threshold or with a coupon, never express", () => {
    const paid = shippingOptions(zone(), { discountedSubtotal: 499999, freeShippingCoupon: false });
    expect(paid.map((o) => [o.id, o.price])).toEqual([
      ["standard", 15000],
      ["express", 30000],
    ]);
    expect(
      shippingOptions(zone(), { discountedSubtotal: 500000, freeShippingCoupon: false })[0],
    ).toMatchObject({ price: 0, isFree: true });
    expect(
      shippingOptions(zone(), { discountedSubtotal: 1, freeShippingCoupon: true })[1]!.price,
    ).toBe(30000);
  });

  it("omits express where the zone has none and reports the gap to free shipping", () => {
    expect(
      shippingOptions(zone({ expressRate: null }), {
        discountedSubtotal: 0,
        freeShippingCoupon: false,
      }),
    ).toHaveLength(1);
    expect(amountToFreeShipping(zone(), 420000)).toBe(80000);
    expect(amountToFreeShipping(zone({ freeOverAmount: null }), 1)).toBeNull();
  });
});

describe("computeTotals", () => {
  it("adds shipping and the COD fee, with tax included in prices by default", () => {
    expect(
      computeTotals({
        subtotal: 700000,
        discount: 70000,
        shipping: 15000,
        codFee: 5000,
        taxRate: 17,
        taxInclusive: true,
      }),
    ).toEqual({
      subtotal: 700000,
      discount: 70000,
      shipping: 15000,
      codFee: 5000,
      tax: 0,
      total: 650000,
    });
  });
  it("adds tax on the discounted subtotal when prices exclude tax", () => {
    expect(
      computeTotals({
        subtotal: 100000,
        discount: 10000,
        shipping: 0,
        codFee: 0,
        taxRate: 17,
        taxInclusive: false,
      }),
    ).toMatchObject({
      tax: 15300,
      total: 105300,
    });
  });
});
