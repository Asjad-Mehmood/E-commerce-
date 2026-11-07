import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@hoodie/validation";
import type { AuthProvidersDTO } from "@hoodie/types";
import type { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { clearAuthCookies, clearCartCookie, COOKIE, setAuthCookies } from "../../lib/cookies";
import { emailEnabled } from "../../lib/email-config";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import { mergeGuestCart } from "../cart/cart.service";
import { AppError } from "../../utils/app-error";
import * as auth from "./auth.service";
import { authorizationRequest, googleClient, googleEnabled } from "./google";

const GOOGLE_COOKIE = "oauth_google";
const oauthCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/api/v1/auth/google",
});
/** Only same-site paths, so the redirect can't send people to another website. */
const safeNext = (next?: string) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/account";
const googleStartQuery = z.object({ next: z.string().max(300).optional() });
const googleCallbackQuery = z.object({
  code: z.string().max(2000).optional(),
  state: z.string().max(200).optional(),
  error: z.string().max(200).optional(),
});

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
    path: "/session",
    summary: "Current session: the signed-in user, or null for guests",
    description:
      "Unlike /auth/me this returns 200 with `data: null` for guests, so browsers don't log errors on every page view. An expired token still returns 401 TOKEN_EXPIRED so the client can refresh.",
    access: "optional",
    handler: async ({ req }) => ok(req.user ? await auth.getUser(req.user.id) : null),
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
  route({
    method: "get",
    path: "/providers",
    summary: "Which sign-in methods are available (Google needs keys on the server)",
    access: "public",
    handler: async () =>
      ok<AuthProvidersDTO>({ google: googleEnabled(), email: await emailEnabled() }),
  }),
  route({
    method: "get",
    path: "/google",
    summary: "Start signing in with Google (browser redirect)",
    description:
      "Redirects to Google. `next` is a storefront path to return to afterwards. 404 unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.",
    access: "public",
    rateLimit: "login",
    query: googleStartQuery,
    handler: ({ res, query }) => {
      if (!googleEnabled()) throw AppError.notFound("Google sign-in");
      const request = authorizationRequest();
      res.cookie(
        GOOGLE_COOKIE,
        JSON.stringify({
          state: request.state,
          verifier: request.verifier,
          next: safeNext(query.next),
        }),
        { ...oauthCookie(), maxAge: 10 * 60 * 1000 },
      );
      res.redirect(302, request.url);
    },
  }),
  route({
    method: "get",
    path: "/google/callback",
    summary: "Google redirects here after sign-in (browser redirect to the storefront)",
    access: "public",
    rateLimit: "login",
    query: googleCallbackQuery,
    handler: async ({ req, res, query }) => {
      const fail = (reason: string) =>
        res.redirect(302, `${env.STOREFRONT_URL}/login?error=${encodeURIComponent(reason)}`);
      const raw = cookies(req)[GOOGLE_COOKIE];
      res.clearCookie(GOOGLE_COOKIE, oauthCookie());
      if (!googleEnabled()) return fail("google");

      let saved: { state: string; verifier: string; next: string } | null = null;
      try {
        saved = raw ? JSON.parse(raw) : null;
      } catch {
        saved = null;
      }
      if (!saved || !query.state || query.state !== saved.state || !query.code) {
        return fail(query.error === "access_denied" ? "google_cancelled" : "google");
      }
      try {
        const idToken = await googleClient.exchangeCode(query.code, saved.verifier);
        const profile = await googleClient.verifyIdToken(idToken);
        await startSession(req, res, await auth.loginWithGoogle(profile, client(req)));
        res.redirect(302, `${env.STOREFRONT_URL}${safeNext(saved.next)}`);
      } catch (err) {
        if (err instanceof AppError && err.code === "ACCOUNT_BLOCKED") return fail("blocked");
        if (err instanceof AppError && err.code === "CONFLICT") return fail("google_exists");
        req.log?.warn({ err }, "Google sign-in failed");
        return fail("google");
      }
    },
  }),
]);
