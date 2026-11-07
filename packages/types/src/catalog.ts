/** Hoodie sizes in display order. */
export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

/** Sort options for product listings (`?sort=`). */
export const PRODUCT_SORTS = [
  "newest",
  "price_asc",
  "price_desc",
  "best_selling",
  "top_rated",
  /** Best match first (search only; falls back to newest without a query). */
  "relevance",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** Sort sizes in the conventional XS → XXL order (unknown sizes go last). */
export function compareSizes(a: string, b: string): number {
  const ia = SIZES.indexOf(a as Size);
  const ib = SIZES.indexOf(b as Size);
  return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
}
