import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@hoodie/validation";
import type { Request, Response } from "express";
import { clearAuthCookies, clearCartCookie, COOKIE, setAuthCookies } from "../../lib/cookies";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import { mergeGuestCart } from "../cart/cart.service";
import * as auth from "./auth.service";

const client = (req: Request): auth.ClientInfo => ({
  userAgent: req.get("user-agent"),
  ip: req.ip,
});

const cookies = (req: Request) => (req.cookies ?? {}) as Record<string, string | undefined>;

/** Sets the session cookies and moves any guest cart into the user's cart. */
async function startSession(req: Request, res: Response, session: auth.Session) {
  setAuthCookies(res, session.accessToken, session.refreshToken);
  const guestCart = cookies(req)[COOKIE.cart];
  if (guestCart) {
    await mergeGuestCart(guestCart, session.user.id);
    clearCartCookie(res);
  }
  // The access token is also returned for non-browser clients (mobile apps, API docs).
  return ok({ user: session.user, accessToken: session.accessToken });
}

export const authRouter = defineRoutes("/auth", "Auth", [
  route({
    method: "post",
    path: "/register",
    summary: "Create a customer account",
    description:
      "Creates the account, signs the user in (sets cookies), sends a verification email and merges any guest cart.",
    access: "public",
    rateLimit: "register",
    body: registerSchema,
    status: 201,
    handler: async ({ req, res, body }) =>
      startSession(req, res, await auth.register(body, client(req))),
  }),
  route({
    method: "post",
    path: "/login",
    summary: "Sign in with email and password",
    description: "Sets httpOnly session cookies and merges any guest cart into the user's cart.",
    access: "public",
    rateLimit: "login",
    body: loginSchema,
    handler: async ({ req, res, body }) =>
      startSession(req, res, await auth.login(body, client(req))),
  }),
  route({
    method: "post",
    path: "/refresh",
    summary: "Rotate the session tokens",
    description:
      "Call when a request returns 401 with reason TOKEN_EXPIRED. Uses the refresh cookie; replaying an old refresh token revokes all of the user's sessions.",
    access: "public",
    handler: async ({ req, res }) => {
      try {
        const session = await auth.refresh(cookies(req)[COOKIE.refresh], client(req));
        setAuthCookies(res, session.accessToken, session.refreshToken);
        return ok({ user: session.user, accessToken: session.accessToken });
      } catch (err) {
        clearAuthCookies(res);
        throw err;
      }
    },
  }),
  route({
    method: "post",
    path: "/logout",
    summary: "Sign out of this device",
    access: "public",
    handler: async ({ req, res }) => {
      await auth.logout(cookies(req)[COOKIE.refresh]);
      clearAuthCookies(res);
    },
  }),
  route({
    method: "get",
    path: "/me",
    summary: "Get the signed-in user",
    access: "user",
    handler: async ({ req }) => ok(await auth.getUser(currentUser(req).id)),
  }),
  route({
    method: "patch",
    path: "/password",
    summary: "Change password",
    description:
      "Signs out all other devices; this one stays signed in. (Lives under /auth because the refresh cookie, which identifies this device, is only sent to /auth paths.)",
    access: "user",
    body: changePasswordSchema,
    handler: async ({ req, body }) => {
      await auth.changePassword(
        currentUser(req).id,
        body.currentPassword,
        body.newPassword,
        cookies(req)[COOKIE.refresh],
      );
    },
  }),
  route({
    method: "post",
    path: "/verify-email",
    summary: "Verify an email address with the token from the email",
    access: "public",
    rateLimit: "emailVerification",
    body: verifyEmailSchema,
    handler: async ({ body }) => ok(await auth.verifyEmail(body.token)),
  }),
  route({
    method: "post",
    path: "/resend-verification",
    summary: "Send a new verification email",
    access: "user",
    rateLimit: "emailVerification",
    handler: async ({ req }) => {
      await auth.resendVerification(currentUser(req).id);
    },
  }),
  route({
    method: "post",
    path: "/forgot-password",
    summary: "Email a password reset link",
    description: "Always returns 204, whether or not the email has an account.",
    access: "public",
    rateLimit: "passwordReset",
    body: forgotPasswordSchema,
    handler: async ({ body }) => {
      await auth.forgotPassword(body.email);
    },
  }),
  route({
    method: "post",
    path: "/reset-password",
    summary: "Set a new password using the reset token",
    description: "Signs out every existing session.",
    access: "public",
    rateLimit: "passwordReset",
    body: resetPasswordSchema,
    handler: async ({ body }) => {
      await auth.resetPassword(body);
    },
  }),
]);
