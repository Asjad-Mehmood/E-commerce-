import { expect, test, type Page } from "@playwright/test";
import { addToCart, findVariant, uniqueEmail } from "./helpers";

async function fillAddress(page: Page, email: string) {
  const main = page.locator("#main");
  await main.getByLabel("Email").fill(email);
  await main.getByLabel("Phone", { exact: true }).fill("03001234567");
  await main.getByLabel("Full name").fill("Checkout Tester");
  await main.getByLabel("Phone for delivery").fill("03001234567");
  await main.getByLabel("Address", { exact: true }).fill("House 7, Street 9, DHA Phase 5");
  await main.getByLabel("City").fill("Karachi");
  await main.getByLabel("Postal code").fill("75500");
  await expect(main.getByText("Delivering to Karachi & Islamabad / Rawalpindi")).toBeVisible();
}

async function goToCheckout(page: Page, request: Parameters<typeof findVariant>[0]) {
  const { slug, variant } = await findVariant(request, "available");
  const drawer = await addToCart(page, slug, variant);
  await drawer.getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
}

test("guest Cash on Delivery checkout, then track and cancel the order", async ({
  page,
  request,
}) => {
  await goToCheckout(page, request);
  const email = uniqueEmail();
  await fillAddress(page, email);

  await page.getByLabel(/Cash on Delivery/).check();
  await expect(page.getByText("Cash on Delivery fee")).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/orders\/US-\d+\?token=.+&placed=1/);
  await expect(page.getByRole("heading", { name: "Your order is confirmed" })).toBeVisible();
  // Email isn't set up in the e2e store, so the page says to bookmark it instead.
  await expect(page.getByText(/Bookmark this page to follow your order/)).toBeVisible();
  const number = (await page.getByRole("heading", { name: /^Order US-/ }).textContent())!.replace(
    "Order ",
    "",
  );
  const orderUrl = page.url();
  await expect(page.getByTestId("cart-count")).toHaveCount(0); // cart emptied

  // Track it like a guest would.
  await page.goto("/track-order");
  await page.getByLabel("Order number").fill(number);
  await page.getByLabel("Email used for the order").fill(email);
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByRole("heading", { name: `Order ${number}` })).toBeVisible();
  await expect(page.getByText("Standard delivery to Karachi")).toBeVisible();

  // Cancel from the order page (the link from the confirmation email).
  await page.goto(orderUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText("Cancelled by the customer.")).toBeVisible();
});

test("card payment in demo mode: a declined card, then a successful one", async ({
  page,
  request,
}) => {
  await goToCheckout(page, request);
  await fillAddress(page, uniqueEmail());
  await page.getByLabel(/Credit or debit card/).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page).toHaveURL(/\/checkout\/pay\?order=US-\d+/);
  await expect(page.getByText("Demo payment mode: no real money is taken.")).toBeVisible();
  await expect(page.getByText(/Your items are reserved for \d+:\d{2}/)).toBeVisible();

  await page.getByRole("button", { name: /4000 0000 0000 0002/ }).click();
  await page.getByRole("button", { name: /^Pay Rs/ }).click();
  await expect(page.locator("#main").getByRole("alert")).toHaveText("Your card was declined.");

  await page.getByRole("button", { name: /4242 4242 4242 4242/ }).click();
  await page.getByRole("button", { name: /^Pay Rs/ }).click();
  await expect(page.getByRole("heading", { name: "Your order is confirmed" })).toBeVisible();
  await expect(page.locator("#main span", { hasText: /^Paid$/ })).toBeVisible(); // status badge
  await expect(page.getByText("Payment failed: Your card was declined.")).toBeVisible(); // in the history
});

test("signed-in checkout with a coupon saves the address and lists the order", async ({
  page,
  request,
}) => {
  // Register
  await page.goto("/register");
  const main = page.locator("#main");
  const email = uniqueEmail();
  await main.getByLabel("Full name").fill("Coupon Buyer");
  await main.getByLabel("Email").fill(email);
  await main.getByLabel("Password").fill("Hoodie123");
  await main.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await goToCheckout(page, request);
  await expect(main.getByLabel("Email")).toHaveValue(email);
  await main.getByLabel("Phone", { exact: true }).fill("03001234567");
  await main.getByLabel("Full name").fill("Coupon Buyer");
  await main.getByLabel("Phone for delivery").fill("03001234567");
  await main.getByLabel("Address", { exact: true }).fill("Flat 3, Blue Area");
  await main.getByLabel("City").fill("Islamabad");
  await main.getByLabel("Postal code").fill("44000");
  await main.getByLabel("Save this address to my account").check();

  await main.getByLabel("Discount code").fill("WELCOME10");
  await main.getByRole("button", { name: "Apply" }).click();
  await expect(main.getByText(/Discount \(WELCOME10\)/)).toBeVisible();

  await page.getByLabel(/Cash on Delivery/).check();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: "Your order is confirmed" })).toBeVisible();
  await expect(page.getByText(/Discount \(WELCOME10\)/)).toBeVisible();
  const number = (await page.getByRole("heading", { name: /^Order US-/ }).textContent())!.replace(
    "Order ",
    "",
  );

  // Order history
  await page.goto("/account/orders");
  await expect(page.getByRole("link", { name: new RegExp(number) })).toBeVisible();

  // Next checkout offers the saved address
  const { slug, variant } = await findVariant(request, "available");
  await addToCart(page, slug, variant);
  await page.goto("/checkout");
  await expect(page.getByText(/Coupon Buyer · Flat 3, Blue Area, Islamabad 44000/)).toBeVisible();
});
