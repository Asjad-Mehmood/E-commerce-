import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Automated accessibility checks (WCAG 2.1 A and AA) on the main pages. */
const PAGES = [
  ["home", "/"],
  ["shop", "/shop"],
  ["category", "/categories/oversized"],
  ["product", "/products/urban-essential-pullover-hoodie"],
  ["cart", "/cart"],
  ["checkout", "/checkout"],
  ["login", "/login"],
  ["register", "/register"],
  ["track order", "/track-order"],
  ["faq", "/faq"],
  ["contact", "/contact"],
  ["policy", "/policies/shipping"],
  ["size guide", "/size-guide"],
  ["search", "/search?q=hoodie"],
] as const;

for (const [name, path] of PAGES) {
  test(`${name} page has no detectable accessibility issues`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const summary = results.violations.map((v) => ({
      rule: v.id,
      impact: v.impact,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
    expect(summary).toEqual([]);
  });
}
