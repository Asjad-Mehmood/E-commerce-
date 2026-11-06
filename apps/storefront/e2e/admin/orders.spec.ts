import { expect, test } from "@playwright/test";
import { adminLogin, placeOrder } from "./admin-helpers";

test("fulfils a Cash on Delivery order and records a cash refund", async ({ page, request }) => {
  const order = await placeOrder(request, "COD");
  await adminLogin(page);

  // Find it with the top-bar search.
  await page.getByLabel("Find an order").fill(order.email);
  await page.getByLabel("Find an order").press("Enter");
  await page.getByRole("link", { name: order.number }).click();
  await expect(page.getByRole("heading", { name: `Order ${order.number}` })).toBeVisible();
  await expect(page.getByText("Guest checkout")).toBeVisible();

  await page.getByRole("button", { name: "Start preparing" }).click();
  await expect(page.getByRole("heading", { name: /Order .* Being prepared/ })).toBeVisible();

  await page.getByRole("button", { name: "Mark as shipped" }).click();
  const ship = page.getByRole("dialog", { name: `Ship order ${order.number}` });
  await ship.getByLabel("Courier").fill("TCS");
  await ship.getByLabel("Tracking number").fill("TCS-778899");
  await ship.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(ship).toBeHidden();
  await expect(page.getByRole("heading", { name: /Shipped/ })).toBeVisible();
  await expect(page.getByText("TCS-778899")).toBeVisible();

  await page.getByRole("button", { name: "Mark as delivered" }).click();
  await expect(page.getByRole("heading", { name: /Delivered/ })).toBeVisible();

  // Cash was collected on delivery, so it can now be refunded (recorded manually).
  await page.getByRole("button", { name: "Refund", exact: true }).click();
  const refund = page.getByRole("dialog", { name: `Refund order ${order.number}` });
  await expect(refund.getByText(/records a refund you pay back yourself/)).toBeVisible();
  await refund.getByLabel("Reason").fill("Returned at the shop");
  await refund.getByRole("button", { name: /^Refund Rs/ }).click();
  await expect(refund).toBeHidden();
  await expect(page.getByRole("heading", { name: /Refunded/ })).toBeVisible();
  await expect(page.getByText("recorded manually")).toBeVisible();

  // Internal notes are saved.
  await page.getByLabel("Internal notes").fill("Customer collected in person");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByText("Notes saved")).toBeVisible();
});

test("refunds a paid card order, which puts the item back in stock", async ({ page, request }) => {
  const order = await placeOrder(request, "STRIPE");
  await adminLogin(page, `/orders/${order.number}`);

  await expect(page.getByRole("heading", { name: /Paid/ })).toBeVisible();
  // Paid card orders are cancelled through a refund, not the cancel button.
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

  await page.getByRole("button", { name: "Refund", exact: true }).click();
  const refund = page.getByRole("dialog", { name: `Refund order ${order.number}` });
  await expect(refund.getByLabel("Put the items back in stock")).toBeChecked();
  await refund.getByLabel("Reason").fill("Customer cancelled");
  await refund.getByRole("button", { name: /^Refund Rs/ }).click();
  await expect(page.getByRole("heading", { name: /Refunded/ })).toBeVisible();
  await expect(page.getByText(/re_demo_/)).toBeVisible();
});

test("filters the order list and keeps filters in the URL", async ({ page, request }) => {
  const order = await placeOrder(request, "COD");
  await adminLogin(page, "/orders");
  await page.getByRole("tab", { name: "To fulfil" }).click();
  await expect(page).toHaveURL(/status=CONFIRMED%2CPAID%2CPROCESSING/);
  await page.getByLabel("Search orders").fill(order.number);
  await expect(page).toHaveURL(new RegExp(`q=${order.number}`));
  await expect(page.getByRole("row")).toHaveCount(2); // header + the order
  await page.reload();
  await expect(page.getByRole("link", { name: order.number })).toBeVisible();
});
