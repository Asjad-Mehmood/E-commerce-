import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { adminLogin } from "./admin-helpers";

const PAGES = [
  "/",
  "/orders",
  "/products",
  "/inventory",
  "/customers",
  "/reports",
  "/settings",
  "/settings/email",
  "/staff",
];

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
}

test("the login page has no detectable accessibility issues", async ({ page }) => {
  await page.goto("/login");
  expect(await violations(page)).toEqual([]);
});

test("the main admin pages have no detectable accessibility issues", async ({ page }) => {
  await adminLogin(page);
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1").first()).toBeVisible();
    expect({ path, violations: await violations(page) }).toEqual({ path, violations: [] });
  }
});
