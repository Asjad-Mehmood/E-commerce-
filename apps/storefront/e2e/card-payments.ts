import { request } from "@playwright/test";
import { ADMIN } from "./admin/admin-helpers";
import { API } from "./helpers";

/**
 * The store takes Cash on Delivery only by default. The card-payment tests
 * need demo card payments, so they are turned on for the test run and back
 * off afterwards (global setup / teardown).
 */
export async function setCardPayments(enabled: boolean) {
  const staff = await request.newContext();
  try {
    const login = await staff.post(`${API}/auth/login`, { data: ADMIN });
    if (!login.ok()) throw new Error(`Admin sign-in failed (${login.status()})`);
    const res = await staff.patch(`${API}/admin/settings`, {
      data: { "payments.card.enabled": enabled },
    });
    if (!res.ok()) throw new Error(`Could not change card payments: ${await res.text()}`);
  } finally {
    await staff.dispose();
  }
}

export default async function setup() {
  await setCardPayments(true);
}
