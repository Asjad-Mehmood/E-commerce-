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
