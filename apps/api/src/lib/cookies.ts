import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

export const COOKIE = {
  access: "access_token",
  refresh: "refresh_token",
  cart: "cart_token",
} as const;

/** The refresh cookie is only sent to auth endpoints, which limits its exposure. */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

const DAY = 24 * 60 * 60 * 1000;

function base(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  // The cookie outlives the 15-minute token on purpose: an expired token is still
  // sent, so the API answers 401 TOKEN_EXPIRED and the client refreshes. If the
  // cookie vanished instead, a signed-in shopper would silently be treated as a
  // guest (e.g. shown an empty cart).
  res.cookie(COOKIE.access, accessToken, {
    ...base(),
    path: "/",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * DAY,
  });
  res.cookie(COOKIE.refresh, refreshToken, {
    ...base(),
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * DAY,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(COOKIE.access, { ...base(), path: "/" });
  res.clearCookie(COOKIE.refresh, { ...base(), path: REFRESH_COOKIE_PATH });
}

export function setCartCookie(res: Response, token: string) {
  res.cookie(COOKIE.cart, token, { ...base(), path: "/", maxAge: 30 * DAY });
}

export function clearCartCookie(res: Response) {
  res.clearCookie(COOKIE.cart, { ...base(), path: "/" });
}
