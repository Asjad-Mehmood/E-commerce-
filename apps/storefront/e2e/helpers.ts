import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";

export const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;

interface Variant {
  id: string;
  size: string;
  color: string;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
}

/** Finds a published product with a variant in the given stock state (seed data has both). */
export async function findVariant(
  request: APIRequestContext,
  status: Variant["stockStatus"] | "available",
) {
  const list = await (await request.get(`${API}/products?limit=50`)).json();
  // Skip throwaway products that other tests create and archive in parallel.
  for (const card of (list.data as { slug: string; title: string }[]).filter(
    (c) => !c.title.startsWith("E2E "),
  )) {
    const detail = (await (await request.get(`${API}/products/${card.slug}`)).json()).data;
    const variant = (detail.variants as Variant[]).find((v) =>
      status === "available" ? v.stockStatus === "in_stock" : v.stockStatus === status,
    );
    if (variant) return { slug: card.slug as string, title: detail.title as string, variant };
  }
  throw new Error(`no variant with status ${status}`);
}

/** Opens a product page and picks a colour + size. */
export async function selectVariant(page: Page, slug: string, v: { color: string; size: string }) {
  await page.goto(`/products/${slug}`);
  await page.getByRole("button", { name: new RegExp(`^${v.color}`) }).click();
  await page.getByRole("button", { name: new RegExp(`^Size ${v.size}(,|$)`) }).click();
}

export async function addToCart(page: Page, slug: string, v: { color: string; size: string }) {
  await selectVariant(page, slug, v);
  await page.getByRole("button", { name: "Add to cart" }).click();
  const drawer = page.getByRole("dialog", { name: /Your cart/ });
  await expect(drawer).toBeVisible();
  return drawer;
}
