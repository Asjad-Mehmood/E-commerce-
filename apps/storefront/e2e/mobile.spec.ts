import { expect, test } from "@playwright/test";

test("menu drawer opens and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.getByRole("link", { name: "Oversized Hoodies" }).click();
  await expect(page).toHaveURL(/\/categories\/oversized$/);
  await expect(menu).toBeHidden();
});

test("filters open in a drawer on small screens", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("button", { name: /^Filters/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filters" });
  await drawer.getByRole("button", { name: "XS", exact: true }).click();
  await expect(page).toHaveURL(/size=XS/);
  await drawer.getByRole("button", { name: /^Show \d+ results?$/ }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("button", { name: /^Filters \(1\)/ })).toBeVisible();
});

test("no horizontal scrolling on key pages", async ({ page }) => {
  for (const path of [
    "/",
    "/shop",
    "/products/urban-essential-pullover-hoodie",
    "/cart",
    "/login",
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, path).toBe(false);
  }
});
