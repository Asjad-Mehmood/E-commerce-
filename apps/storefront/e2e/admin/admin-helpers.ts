import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { API, findVariant, uniqueEmail } from "../helpers";

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@hoodie.local",
  password: process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123",
};

export async function adminLogin(page: Page, path = "/") {
  await page.goto(`/login${path === "/" ? "" : `?next=${encodeURIComponent(path)}`}`);
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(path);
}

const address = {
  fullName: "Admin Test Buyer",
  phone: "03001234567",
  line1: "House 1, Street 2",
  city: "Lahore",
  postalCode: "54000",
};

/** Places an order through the API as a guest (COD, or card paid with a demo test card). */
export async function placeOrder(request: APIRequestContext, method: "COD" | "STRIPE" = "COD") {
  const { variant } = await findVariant(request, "available");
  const add = await request.post(`${API}/cart/items`, {
    data: { variantId: variant.id, quantity: 1 },
  });
  expect(add.ok()).toBeTruthy();
  const email = uniqueEmail();
  const res = await request.post(`${API}/checkout`, {
    data: {
      email,
      phone: address.phone,
      shippingAddress: address,
      shippingMethod: "standard",
      paymentMethod: method,
      idempotencyKey: randomUUID(),
    },
  });
  expect(res.status()).toBe(201);
  const order = (await res.json()).data as {
    orderNumber: string;
    payment: { clientSecret: string } | null;
  };
  if (method === "STRIPE") {
    const paid = await request.post(`${API}/payments/demo/confirm`, {
      data: {
        clientSecret: order.payment!.clientSecret,
        cardNumber: "4242424242424242",
        expiry: "12/30",
        cvc: "123",
      },
    });
    expect((await paid.json()).data.status).toBe("succeeded");
  }
  return { number: order.orderNumber, email };
}

/**
 * A signed-in customer (API request context) with a delivered Cash on Delivery
 * order, ready for reviews and returns.
 */
export async function customerWithDeliveredOrder(playwright: {
  request: { newContext: () => Promise<APIRequestContext> };
}) {
  const customer = await playwright.request.newContext();
  const email = uniqueEmail();
  const password = "Customer123";
  const reg = await customer.post(`${API}/auth/register`, {
    data: { name: "Review Tester", email, password },
  });
  expect(reg.status()).toBe(201);

  // A seeded product: other tests create and archive their own products in parallel.
  const slug = "classic-pullover-hoodie";
  const detail = (await (await customer.get(`${API}/products/${slug}`)).json()).data;
  const title = detail.title as string;
  const variant = (detail.variants as { id: string; stockStatus: string }[]).find(
    (v) => v.stockStatus !== "out_of_stock",
  )!;
  await customer.post(`${API}/cart/items`, { data: { variantId: variant.id, quantity: 1 } });
  const res = await customer.post(`${API}/checkout`, {
    data: {
      email,
      phone: address.phone,
      shippingAddress: address,
      shippingMethod: "standard",
      paymentMethod: "COD",
      idempotencyKey: randomUUID(),
    },
  });
  expect(res.status()).toBe(201);
  const number = (await res.json()).data.orderNumber as string;

  const staff = await playwright.request.newContext();
  await staff.post(`${API}/auth/login`, { data: ADMIN });
  for (const status of ["PROCESSING", "SHIPPED", "DELIVERED"]) {
    const r = await staff.patch(`${API}/admin/orders/${number}/status`, { data: { status } });
    expect(r.ok()).toBeTruthy();
  }
  return { customer, staff, email, password, number, slug, title };
}
