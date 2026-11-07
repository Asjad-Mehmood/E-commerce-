import { expect, test } from "@playwright/test";
import { addToCart, findVariant, uniqueEmail } from "./helpers";

const PASSWORD = "Hoodie123";

test("the account area sends guests to sign in", async ({ page }) => {
  await page.goto("/account/addresses");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Faddresses/);
});

test("a wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  const main = page.locator("#main");
  await main.getByLabel("Email").fill("customer@hoodie.local");
  await main.getByLabel("Password").fill("WrongPass123");
  await main.getByRole("button", { name: "Sign in" }).click();
  await expect(main.getByRole("alert")).toHaveText("Incorrect email or password");
});

test("register keeps the guest cart, then manage addresses and sign out", async ({
  page,
  request,
}) => {
  const { slug, variant } = await findVariant(request, "available");
  await addToCart(page, slug, variant);
  await page.keyboard.press("Escape");

  const email = uniqueEmail();
  await page.goto("/register");
  const main = page.locator("#main");
  await main.getByLabel("Full name").fill("Playwright Tester");
  await main.getByLabel("Email").fill(email);
  await main.getByLabel("Password").fill(PASSWORD);
  await main.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Hi Playwright, welcome back.")).toBeVisible();
  // Email isn't set up in the e2e store, so no "verify your email" prompt.
  await expect(page.getByText(`Please verify ${email}`)).toHaveCount(0);
  await expect(page.getByTestId("cart-count")).toHaveText("1"); // guest cart merged

  // Address book
  await page
    .getByRole("navigation", { name: "Account" })
    .getByRole("link", { name: "Addresses" })
    .click();
  await page.getByRole("button", { name: "Add address" }).click();
  const dialog = page.getByRole("dialog", { name: "Add address" });
  await dialog.getByRole("button", { name: "Save address" }).click();
  await expect(dialog.getByText(/Too small|Invalid|Enter a valid/).first()).toBeVisible(); // client validation

  await dialog.getByLabel("Full name").fill("Playwright Tester");
  await dialog.getByLabel("Phone").fill("03001234567");
  await dialog.getByLabel("Address", { exact: true }).fill("House 1, Street 2, Gulberg");
  await dialog.getByLabel("City").fill("Lahore");
  await dialog.getByLabel("Postal code").fill("54000");
  await dialog.getByRole("button", { name: "Save address" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("House 1, Street 2, Gulberg")).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toBeVisible();

  // Sign out
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveCount(0); // the cart belongs to the account

  // Sign back in → returns to the requested page with the cart restored
  await page.goto("/account/profile");
  await main.getByLabel("Email").fill(email);
  await main.getByLabel("Password").fill(PASSWORD);
  await main.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
  await expect(page.getByTestId("cart-count")).toHaveText("1");
});
