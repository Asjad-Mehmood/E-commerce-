/**
 * Pure pricing rules (no database access), so they are easy to test.
 * All amounts are integers in minor units (paisa).
 */
import type { ShippingMethodId, ShippingOptionDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import type { Coupon, ShippingZone } from "@prisma/client";

// ───────────── Coupons ─────────────

export type CouponCheck = { ok: true } | { ok: false; reason: string };

/** Whether a coupon can be used for this subtotal right now. */
export function checkCoupon(
  coupon: Pick<
    Coupon,
    | "isActive"
    | "startsAt"
    | "endsAt"
    | "minOrderAmount"
    | "maxUses"
    | "usedCount"
    | "maxUsesPerUser"
  >,
  ctx: { subtotal: number; now?: Date; usesByCustomer?: number },
): CouponCheck {
  const now = ctx.now ?? new Date();
  if (!coupon.isActive) return { ok: false, reason: "This code is not valid" };
  if (coupon.startsAt && coupon.startsAt > now)
    return { ok: false, reason: "This code is not active yet" };
  if (coupon.endsAt && coupon.endsAt <= now) return { ok: false, reason: "This code has expired" };
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: "This code has reached its usage limit" };
  }
  if (coupon.maxUsesPerUser != null && (ctx.usesByCustomer ?? 0) >= coupon.maxUsesPerUser) {
    return { ok: false, reason: "You have already used this code" };
  }
  if (coupon.minOrderAmount != null && ctx.subtotal < coupon.minOrderAmount) {
    return {
      ok: false,
      reason: `Spend ${formatMoney(coupon.minOrderAmount)} or more to use this code`,
    };
  }
  return { ok: true };
}

/** Amount taken off the subtotal. Free-shipping coupons discount shipping instead (0 here). */
export function couponDiscount(coupon: Pick<Coupon, "type" | "value">, subtotal: number): number {
  switch (coupon.type) {
    case "PERCENTAGE":
      // Rounded down to whole rupees (100 paisa): prices are in whole rupees,
      // so totals like "Rs 3,569.10" would look odd. Rounding favours the customer.
      return Math.floor((subtotal * Math.min(Math.max(coupon.value, 0), 100)) / 100 / 100) * 100;
    case "FIXED":
      return Math.min(Math.max(coupon.value, 0), subtotal);
    case "FREE_SHIPPING":
      return 0;
  }
}

// ───────────── Shipping ─────────────

type Zone = Pick<
  ShippingZone,
  | "name"
  | "regions"
  | "standardRate"
  | "expressRate"
  | "freeOverAmount"
  | "codFee"
  | "codEnabled"
  | "estimatedDays"
  | "position"
  | "isActive"
>;

/** The zone whose regions include the city; otherwise the "*" fallback zone. */
export function pickZone<T extends Zone>(zones: T[], city: string): T | null {
  const active = zones.filter((z) => z.isActive).sort((a, b) => a.position - b.position);
  const key = city.trim().toLowerCase();
  return (
    active.find((z) => key && z.regions.includes(key)) ??
    active.find((z) => z.regions.includes("*")) ??
    null
  );
}

/**
 * Delivery options for a zone. Standard delivery is free over the zone's
 * threshold (checked against the subtotal after discounts) or with a
 * free-shipping coupon. Express is always charged.
 */
export function shippingOptions(
  zone: Zone,
  opts: { discountedSubtotal: number; freeShippingCoupon: boolean },
): ShippingOptionDTO[] {
  const freeStandard =
    opts.freeShippingCoupon ||
    (zone.freeOverAmount != null && opts.discountedSubtotal >= zone.freeOverAmount);
  const options: ShippingOptionDTO[] = [
    {
      id: "standard",
      label: "Standard delivery",
      price: freeStandard ? 0 : zone.standardRate,
      estimatedDays: zone.estimatedDays,
      isFree: freeStandard,
    },
  ];
  if (zone.expressRate != null) {
    options.push({
      id: "express",
      label: "Express delivery",
      price: zone.expressRate,
      estimatedDays: "1",
      isFree: false,
    });
  }
  return options;
}

export function amountToFreeShipping(zone: Zone, discountedSubtotal: number): number | null {
  if (zone.freeOverAmount == null) return null;
  return Math.max(0, zone.freeOverAmount - discountedSubtotal);
}

// ───────────── Totals ─────────────

export interface Totals {
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  tax: number;
  total: number;
}

/**
 * Grand total. With tax-inclusive pricing (the default for PKR) no tax is
 * added; with exclusive pricing, tax is charged on the discounted subtotal.
 */
export function computeTotals(input: {
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  taxRate: number;
  taxInclusive: boolean;
}): Totals {
  const discount = Math.min(input.discount, input.subtotal);
  const taxable = input.subtotal - discount;
  const tax = input.taxInclusive ? 0 : Math.round((taxable * input.taxRate) / 100);
  return {
    subtotal: input.subtotal,
    discount,
    shipping: input.shipping,
    codFee: input.codFee,
    tax,
    total: taxable + input.shipping + input.codFee + tax,
  };
}

export const SHIPPING_LABEL: Record<ShippingMethodId, string> = {
  standard: "Standard delivery",
  express: "Express delivery",
};
