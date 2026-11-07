import { expect, test } from "@playwright/test";

test("home page shows the hero, categories and products", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Shop by style" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best sellers" })).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
});

test("mega menu leads to a category page that only lists that category", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: "Shop" })
    .click();
  await page
    .locator("#mega-menu")
    .getByRole("link", { name: /Zip-Up Hoodies/ })
    .click();

  await expect(page).toHaveURL(/\/categories\/zip-up$/);
  await expect(page.getByRole("heading", { level: 1, name: "Zip-Up Hoodies" })).toBeVisible();
  await expect(page.getByText(/^2 products$/)).toBeVisible();
});

test("filters update the URL and results, and can be cleared", async ({ page }) => {
  await page.goto("/shop");
  // The filters work once the page's scripts have loaded.
  await page.waitForLoadState("networkidle");
  const count = page.getByText(/^\d+ products?$/);
  const before = await count.textContent();

  await page.getByRole("checkbox", { name: "Blush Pink" }).check();
  await expect(page).toHaveURL(/color=Blush/);
  await expect(count).toHaveText("1 product");
  await expect(page.getByRole("heading", { name: "Pastel Relaxed Hoodie" })).toBeVisible();

  await page.getByRole("button", { name: "Remove filter: Blush Pink" }).click();
  await expect(page).not.toHaveURL(/color=/);
  await expect(count).toHaveText(before!);
});

test("sorting by price orders the grid", async ({ page }) => {
  await page.goto("/shop");
  await page.getByLabel("Sort products").selectOption("price_asc");
  await expect(page).toHaveURL(/sort=price_asc/);
  const prices = await page.locator("article p span.font-semibold").allTextContents();
  const values = prices.map((p) => Number(p.replace(/[^\d]/g, "")));
  expect(values).toEqual([...values].sort((a, b) => a - b));
});

test("search finds products", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("searchbox", { name: "Search hoodies" }).fill("sherpa");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sherpa Zip Hoodie" })).toBeVisible();
});

test("a missing product returns a real 404", async ({ page }) => {
  const res = await page.goto("/products/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn’t find that page" })).toBeVisible();
});

test("size guide recommends a size", async ({ page }) => {
  await page.goto("/products/urban-essential-pullover-hoodie");
  await page.getByRole("button", { name: "Size guide" }).click();
  const dialog = page.getByRole("dialog", { name: /Size guide/ });
  await dialog.getByLabel(/Your chest measurement/).fill("38");
  await expect(dialog.getByRole("status")).toContainText("We recommend M");
  await dialog.getByRole("button", { name: "Select M" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /^Size M/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
