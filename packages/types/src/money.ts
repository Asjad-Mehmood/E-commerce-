/**
 * Money is ALWAYS stored and transferred as an integer number of minor units
 * (paisa for PKR, cents for USD). Never use floats for money.
 */

export const DEFAULT_CURRENCY = "PKR";

/** Convert major units (e.g. 3499.5 rupees) to minor units (349950 paisa). */
export function toMinor(major: number): number {
  return Math.round(major * 100);
}

/** Convert minor units to major units. For display/calculation only, never storage. */
export function toMajor(minor: number): number {
  return minor / 100;
}

/** Format minor units for display, e.g. `formatMoney(349900)` → "Rs 3,499". */
export function formatMoney(
  minor: number,
  currency: string = DEFAULT_CURRENCY,
  locale = "en-PK",
): string {
  const major = toMajor(minor);
  const hasFraction = minor % 100 !== 0;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(major);
  // Intl renders PKR as "Rs" + nbsp in en-PK; normalise to a plain space.
  return formatted.replace(/\u00a0/g, " ");
}

/** Percentage saved between a compare-at price and the selling price (rounded down). */
export function discountPercent(price: number, compareAtPrice?: number | null): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.floor(((compareAtPrice - price) / compareAtPrice) * 100);
}
