import { expect, test, type Page } from "@playwright/test";
import { customerWithDeliveredOrder } from "./admin/admin-helpers";
import { API } from "./helpers";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/account");
}

test("search suggests products as you type, even with a typo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open search" }).click();
  await page.getByRole("combobox", { name: "Search hoodies" }).fill("sherpaa");
  const option = page.getByRole("option", { name: /Sherpa Zip Hoodie/ });
  await expect(option).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products\/sherpa-zip-hoodie$/);
});

test("remembers recently viewed products", async ({ page }) => {
  await page.goto("/products/zip-up-fleece-hoodie");
  // The visit is recorded once the page is interactive.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("recently-viewed")))
    .toContain("zip-up-fleece-hoodie");
  await page.goto("/products/urban-essential-pullover-hoodie");
  const strip = page.getByRole("region", { name: "Recently viewed" });
  await expect(strip.getByRole("heading", { name: "Zip-Up Fleece Hoodie" })).toBeVisible();
});

test("guests are asked to sign in before saving to the wishlist", async ({ page }) => {
  await page.goto("/products/urban-essential-pullover-hoodie");
  await page
    .getByRole("button", { name: "Save Urban Essential Pullover Hoodie to wishlist" })
    .first()
    .click();
  await expect(page).toHaveURL("/login?next=%2Fproducts%2Furban-essential-pullover-hoodie");
});

test("a customer reviews a delivered hoodie, saves it, and requests a return", async ({
  page,
  playwright,
}) => {
  const { email, password, number, slug, title } = await customerWithDeliveredOrder(playwright);
  await signIn(page, email, password);

  // Wishlist
  await page.goto(`/products/${slug}`);
  await page
    .getByRole("button", { name: `Save ${title} to wishlist` })
    .first()
    .click();
  await expect(page.getByText("Saved to your wishlist")).toBeVisible();
  await page.goto("/account/wishlist");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Review (waits for moderation)
  await page.goto(`/products/${slug}#reviews`);
  await page.getByRole("button", { name: "Write a review" }).click();
  await page.getByRole("radio", { name: /^4 stars/ }).click();
  await page.getByLabel("Your review").fill("Warm, soft, and the size chart was spot on.");
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByText("Your review will appear after a quick check")).toBeVisible();
  await expect(page.getByText("waiting for a quick check")).toBeVisible();

  // Return
  await page.goto(`/orders/${number}`);
  await page.getByRole("button", { name: "Request a return" }).click();
  const dialog = page.getByRole("dialog", { name: "Request a return" });
  await dialog.getByRole("combobox", { name: /How many/ }).selectOption("1");
  await dialog.getByLabel("Reason").selectOption("wrong_size");
  await dialog.getByLabel("Anything else? (optional)").fill("Please send an L instead.");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("We'll review your request within 2 working days")).toBeVisible();
  await expect(page.getByRole("button", { name: "Request a return" })).toHaveCount(0);
});

test("unsubscribe links ask before unsubscribing", async ({ page, request }) => {
  // A forged link is refused (real links are signed and come from our emails).
  await page.goto(
    "/unsubscribe?type=newsletter&email=someone%40test.local&token=xxxxxxxxxxxxxxxxxxxxxxxx",
  );
  await expect(page.getByText("Stop sending our newsletter to someone@test.local?")).toBeVisible();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByText("This unsubscribe link is invalid")).toBeVisible();
  expect((await request.get(`${API}/health`)).ok()).toBeTruthy();
});
