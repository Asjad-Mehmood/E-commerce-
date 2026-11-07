import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env";
import { prisma } from "../src/lib/prisma";
import { googleClient, type GoogleProfile } from "../src/modules/auth/google";
import { app, cookieValue, createUser, uniqueEmail } from "./helpers";

beforeAll(() => {
  env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
  env.GOOGLE_CLIENT_SECRET = "test-secret";
});
afterAll(() => {
  env.GOOGLE_CLIENT_ID = undefined;
  env.GOOGLE_CLIENT_SECRET = undefined;
  vi.restoreAllMocks();
});

/** Starts the flow, then comes back from "Google" signed in as `profile`. */
async function signInWithGoogle(profile: GoogleProfile, next = "/account/orders") {
  const agent = request.agent(app);
  const start = await agent.get(`/api/v1/auth/google?next=${encodeURIComponent(next)}`);
  expect(start.status).toBe(302);
  const google = new URL(start.headers.location!);
  expect(google.origin).toBe("https://accounts.google.com");
  expect(google.searchParams.get("code_challenge_method")).toBe("S256");
  expect(google.searchParams.get("redirect_uri")).toBe(
    `${env.API_PUBLIC_URL}/api/v1/auth/google/callback`,
  );

  vi.spyOn(googleClient, "exchangeCode").mockResolvedValue("id-token");
  vi.spyOn(googleClient, "verifyIdToken").mockResolvedValue(profile);
  const back = await agent.get(
    `/api/v1/auth/google/callback?code=abc&state=${google.searchParams.get("state")}`,
  );
  return { agent, back };
}

const profile = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
  sub: `g-${Math.random().toString(36).slice(2)}`,
  email: uniqueEmail("google"),
  emailVerified: true,
  name: "Sana Tariq",
  ...over,
});

describe("Google sign-in", () => {
  it("reports whether it is available", async () => {
    expect((await request(app).get("/api/v1/auth/providers")).body.data.google).toBe(true);
  });

  it("creates an account and signs in, returning to the page the shopper came from", async () => {
    const p = profile();
    const { agent, back } = await signInWithGoogle(p);
    expect(back.status).toBe(302);
    expect(back.headers.location).toBe(`${env.STOREFRONT_URL}/account/orders`);
    expect(cookieValue(back, "access_token")).toBeTruthy();

    const me = await agent.get("/api/v1/auth/me");
    expect(me.body.data).toMatchObject({ email: p.email, name: "Sana Tariq", emailVerified: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: p.email } })).googleId).toBe(
      p.sub,
    );

    // Signing in again finds the same account.
    await signInWithGoogle(p);
    expect(await prisma.user.count({ where: { email: p.email } })).toBe(1);
  });

  it("links an existing account when Google has verified the email", async () => {
    const user = await createUser();
    const p = profile({ email: user.email });
    const { back } = await signInWithGoogle(p);
    expect(back.headers.location).toBe(`${env.STOREFRONT_URL}/account/orders`);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).googleId).toBe(p.sub);
  });

  it("refuses to take over an account with an unverified Google email", async () => {
    const user = await createUser();
    const { back } = await signInWithGoogle(profile({ email: user.email, emailVerified: false }));
    expect(back.headers.location).toBe(`${env.STOREFRONT_URL}/login?error=google_exists`);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).googleId).toBeNull();
  });

  it("rejects a callback without the matching state, and blocked accounts", async () => {
    const forged = await request(app).get("/api/v1/auth/google/callback?code=abc&state=guess");
    expect(forged.headers.location).toBe(`${env.STOREFRONT_URL}/login?error=google`);

    const blocked = await createUser({ isBlocked: true });
    const { back } = await signInWithGoogle(profile({ email: blocked.email }));
    expect(back.headers.location).toBe(`${env.STOREFRONT_URL}/login?error=blocked`);
  });

  it("only redirects to paths on the storefront", async () => {
    const { back } = await signInWithGoogle(profile(), "https://evil.example/steal");
    expect(back.headers.location).toBe(`${env.STOREFRONT_URL}/account`);
  });
});
