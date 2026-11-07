import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

/**
 * The secret in an order link (/orders/US-10001?token=…), which lets a guest
 * view their order without an account. Derived from the order id with a server
 * secret, so it never has to be stored and a retried checkout gets the same link.
 */
export function orderAccessToken(orderId: string): string {
  return createHmac("sha256", env.JWT_ACCESS_SECRET)
    .update(`order-link:${orderId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function isValidOrderToken(orderId: string, token: string | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(orderAccessToken(orderId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const orderLink = (orderNumber: string, orderId: string) =>
  `${env.STOREFRONT_URL}/orders/${orderNumber}?token=${orderAccessToken(orderId)}`;
