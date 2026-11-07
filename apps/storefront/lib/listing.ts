import { PRODUCT_SORTS, type ProductSort } from "@hoodie/types";

export type SearchParams = Record<string, string | string[] | undefined>;

export interface ListingFilters {
  q?: string;
  size: string[];
  color: string[];
  fit: string[];
  /** Price bounds in rupees (major units), as shown in the URL. */
  min?: number;
  max?: number;
  inStock: boolean;
  sort: ProductSort;
  page: number;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => first(v)?.split(",").filter(Boolean) ?? [];
const num = (v: string | string[] | undefined) => {
  const n = Number(first(v));
  return Number.isFinite(n) && n >= 0 && first(v) !== "" && first(v) !== undefined ? n : undefined;
};

/** Reads listing filters from the page URL. */
export function parseFilters(sp: SearchParams): ListingFilters {
  const sort = first(sp.sort) as ProductSort | undefined;
  const q = first(sp.q)?.trim() || undefined;
  return {
    q,
    size: list(sp.size),
    color: list(sp.color),
    fit: list(sp.fit),
    min: num(sp.min),
    max: num(sp.max),
    inStock: first(sp.inStock) === "true",
    sort: sort && PRODUCT_SORTS.includes(sort) ? sort : defaultSort(q),
    page: Math.max(1, Math.floor(num(sp.page) ?? 1)),
  };
}

/** Searches show the best matches first; other listings show the newest. */
export const defaultSort = (q?: string): ProductSort => (q ? "relevance" : "newest");

export const PAGE_SIZE = 12;

/** Builds the API query string (`/products?...`); prices are converted to minor units. */
export function toApiQuery(
  f: ListingFilters,
  scope: { category?: string; collection?: string },
): string {
  const p = new URLSearchParams();
  if (scope.category) p.set("category", scope.category);
  if (scope.collection) p.set("collection", scope.collection);
  if (f.q) p.set("q", f.q);
  if (f.size.length) p.set("size", f.size.join(","));
  if (f.color.length) p.set("color", f.color.join(","));
  if (f.fit.length) p.set("fit", f.fit.join(","));
  if (f.min !== undefined) p.set("minPrice", String(Math.round(f.min * 100)));
  if (f.max !== undefined) p.set("maxPrice", String(Math.round(f.max * 100)));
  if (f.inStock) p.set("inStock", "true");
  p.set("sort", f.sort);
  p.set("page", String(f.page));
  p.set("limit", String(PAGE_SIZE));
  return p.toString();
}

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest",
  best_selling: "Best selling",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  top_rated: "Top rated",
  relevance: "Best match",
};

export function countActiveFilters(f: ListingFilters): number {
  return (
    f.size.length +
    f.color.length +
    f.fit.length +
    (f.min !== undefined || f.max !== undefined ? 1 : 0) +
    (f.inStock ? 1 : 0)
  );
}
