import { expect, test } from "@playwright/test";
import { API } from "../helpers";
import { adminLogin, customerWithDeliveredOrder } from "./admin-helpers";

test("moderates a review and handles a return through to the refund", async ({
  page,
  playwright,
}) => {
  const { customer, number, slug } = await customerWithDeliveredOrder(playwright);
  const review = await customer.put(`${API}/products/${slug}/reviews`, {
    data: { rating: 5, title: "Admin e2e", body: `Order ${number}: great fit and warm.` },
  });
  expect(review.ok(), await review.text()).toBeTruthy();
  const order = (await (await customer.get(`${API}/orders/${number}`)).json()).data;
  const requested = await customer.post(`${API}/orders/${number}/returns`, {
    data: { items: [{ orderItemId: order.items[0].id, quantity: 1 }], reason: "damaged" },
  });
  expect(requested.status()).toBe(201);

  // Publish the review.
  await adminLogin(page, "/reviews");
  const card = page.getByRole("listitem").filter({ hasText: `Order ${number}` });
  await card.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Review published")).toBeVisible();
  const reviews = await (await customer.get(`${API}/products/${slug}/reviews?limit=50`)).json();
  expect(reviews.data.map((r: { title: string }) => r.title)).toContain("Admin e2e");

  // Approve → received (restock) → refund.
  await page.goto("/returns?status=REQUESTED");
  await page
    .getByRole("row", { name: new RegExp(number) })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`Return for ${number}`) }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Return approved.")).toBeVisible();

  await page.getByRole("button", { name: "Parcel received" }).click();
  const receive = page.getByRole("dialog");
  await expect(receive.getByLabel("Put the items back in stock")).toBeChecked();
  await receive.getByRole("button", { name: "Mark received" }).click();
  await expect(page.getByText("Marked as received.")).toBeVisible();

  await page.getByRole("button", { name: "Refund", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Refund", exact: true }).click();
  await expect(page.getByText(/^Refunded Rs/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Refunded/ })).toBeVisible();

  // The customer sees it on their order.
  const after = (await (await customer.get(`${API}/orders/${number}`)).json()).data;
  expect(after.returns[0]).toMatchObject({ status: "REFUNDED" });
});
