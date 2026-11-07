import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

/**
 * Short HMAC signatures for links in emails (e.g. unsubscribe), so a link
 * works without signing in but can't be forged for someone else's email.
 */
export function sign(purpose: string, value: string): string {
  return createHmac("sha256", env.JWT_ACCESS_SECRET)
    .update(`${purpose}:${value.toLowerCase()}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifySigned(purpose: string, value: string, token: string): boolean {
  const expected = Buffer.from(sign(purpose, value));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** A storefront link that switches off one kind of email for this address. */
export const unsubscribeLink = (type: "newsletter" | "cart", email: string) =>
  `${env.STOREFRONT_URL}/unsubscribe?${new URLSearchParams({
    type,
    email,
    token: sign(`unsubscribe-${type}`, email),
  })}`;
