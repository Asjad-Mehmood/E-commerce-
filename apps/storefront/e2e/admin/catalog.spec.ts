import { expect, test } from "@playwright/test";
import { API } from "../helpers";
import { adminLogin, adminUrl } from "./admin-helpers";

test("creates a product, generates variants, adjusts stock and publishes it", async ({
  page,
  request,
}) => {
  const title = `E2E Hoodie ${Date.now().toString(36)}`;
  await adminLogin(page, "/products/new");

  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A hoodie created by the admin end-to-end test.");
  await page.getByLabel("Price", { exact: true }).fill("2999");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/products\/[a-z0-9]+$/);
  await expect(page.getByText("Product created")).toBeVisible();

  // Generate S, M, L, XL in Black with 5 each.
  await page.getByLabel("Starting stock per variant").fill("5");
  await page.getByRole("button", { name: "Generate 4 variants" }).click();
  await expect(page.getByText("Created 4 variant(s)")).toBeVisible();
  await expect(page.getByLabel(/^SKU for Black/)).toHaveCount(4);

  // Restock one size.
  await page
    .getByRole("row", { name: /Black \/ M/ })
    .getByRole("button", { name: "Adjust" })
    .click();
  const dialog = page.getByRole("dialog", { name: /Adjust stock: Black \/ M/ });
  await dialog.getByLabel("Units").fill("10");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock for Black / M is now 15")).toBeVisible();

  // Publish.
  await page.getByLabel("Visibility").selectOption("ACTIVE");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Product saved")).toBeVisible();

  const slug = (await page.getByText(/^\d+ sold · \/products\//).textContent())!.split(
    "/products/",
  )[1]!;
  const live = await request.get(`${API}/products/${slug}`);
  expect(live.status()).toBe(200);
  const product = (await live.json()).data;
  expect(product.title).toBe(title);
  expect(product.variants).toHaveLength(4);

  // Archive it again so it doesn't linger in the shop.
  await page.getByRole("button", { name: "Archive product" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
  await expect(page).toHaveURL(adminUrl("/products"));
  expect((await request.get(`${API}/products/${slug}`)).status()).toBe(404);
});

test("creates a coupon that works at checkout", async ({ page, request }) => {
  const code = `E2E${Date.now().toString(36).toUpperCase()}`;
  await adminLogin(page, "/coupons");
  await page.getByRole("button", { name: "New coupon" }).click();
  const dialog = page.getByRole("dialog", { name: "New coupon" });
  await dialog.getByLabel("Code", { exact: true }).fill(code);
  await dialog.getByLabel("Value", { exact: true }).fill("15");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`Created ${code}`)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(code) })).toContainText("15% off");

  // The storefront accepts it.
  const products = (await (await request.get(`${API}/products?limit=1`)).json()).data;
  const detail = (await (await request.get(`${API}/products/${products[0].slug}`)).json()).data;
  const variant = detail.variants.find(
    (v: { stockStatus: string }) => v.stockStatus !== "out_of_stock",
  );
  await request.post(`${API}/cart/items`, { data: { variantId: variant.id, quantity: 1 } });
  const applied = await request.post(`${API}/cart/coupon`, { data: { code } });
  expect(applied.ok()).toBeTruthy();
  expect((await applied.json()).data.coupon.code).toBe(code);
});
