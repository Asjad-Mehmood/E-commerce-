import { expect, test } from "@playwright/test";
import { API, uniqueEmail } from "../helpers";
import { adminLogin } from "./admin-helpers";

test("sends signed-out visitors to the login page and back", async ({ page }) => {
  await page.goto("/orders");
  await expect(page).toHaveURL("/login?next=%2Forders");
  await adminLogin(page, "/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
});

test("refuses customer accounts", async ({ page, request }) => {
  const email = uniqueEmail();
  const res = await request.post(`${API}/auth/register`, {
    data: { name: "Just A Customer", email, password: "Customer123" },
  });
  expect(res.status()).toBe(201);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Customer123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("This account does not have access to the admin panel."),
  ).toBeVisible();
  await expect(page).toHaveURL("/login");
});

test("shows the dashboard and signs out", async ({ page }) => {
  await adminLogin(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Net sales per day")).toBeVisible();
  await page.getByRole("button", { name: "Show as table" }).click();
  await expect(page.getByRole("columnheader", { name: "Net sales" })).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
});
