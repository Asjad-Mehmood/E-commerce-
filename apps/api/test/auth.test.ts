import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256 } from "../src/lib/crypto";
import { testOutbox } from "../src/lib/mailer";
import { prisma } from "../src/lib/prisma";
import { app, cookieValue, createUser, PASSWORD, signedInAgent, uniqueEmail } from "./helpers";

/** Pulls the `token` query parameter out of the last email sent to `to`. */
function tokenFromEmail(to: string): string {
  const mail = [...testOutbox].reverse().find((m) => m.to === to);
  if (!mail) throw new Error(`no email sent to ${to}`);
  const match = mail.text.match(/token=([\w-]+)/);
  if (!match?.[1]) throw new Error("no token in email");
  return match[1];
}

beforeEach(() => {
  testOutbox.length = 0;
});

describe("POST /auth/register", () => {
  it("creates the account, signs in with httpOnly cookies and sends a verification email", async () => {
    const email = uniqueEmail("reg");
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Ali Khan", email: email.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email,
      name: "Ali Khan",
      role: "CUSTOMER",
      emailVerified: false,
    });
    expect(res.body.data.user).not.toHaveProperty("passwordHash");

    const cookies = (res.headers["set-cookie"] as unknown as string[]).join("\n");
    expect(cookies).toMatch(/access_token=.+HttpOnly/);
    expect(cookies).toMatch(/refresh_token=.+Path=\/api\/v1\/auth.+HttpOnly/);
    expect(cookies).toMatch(/SameSite=Lax/);

    expect(testOutbox.some((m) => m.to === email && m.subject.includes("Verify"))).toBe(true);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("rejects a duplicate email with 409", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Someone", email: user.email, password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it("rejects a weak password with field errors", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Weak", email: uniqueEmail(), password: "password" });
    expect(res.status).toBe(422);
    expect(res.body.error.details.fieldErrors.password).toBeDefined();
  });
});

describe("POST /auth/login", () => {
  it("signs in and returns the user", async () => {
    const user = await createUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(cookieValue(res, "access_token")).toBeTruthy();
  });

  it("gives the same error for a wrong password and an unknown email (no account enumeration)", async () => {
    const user = await createUser();
    const wrong = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "Wrong1234" });
    const unknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: uniqueEmail(), password: PASSWORD });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it("blocks blocked accounts", async () => {
    const user = await createUser({ isBlocked: true });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_BLOCKED");
  });
});

describe("GET /auth/me", () => {
  it("works with the session cookie", async () => {
    const { agent, user } = await signedInAgent();
    const res = await agent.get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it("works with a Bearer token", async () => {
    const { accessToken, user } = await signedInAgent();
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.body.data.id).toBe(user.id);
  });

  it("returns 401 without a session, and for a tampered token", async () => {
    expect((await request(app).get("/api/v1/auth/me")).status).toBe(401);
    const { accessToken } = await signedInAgent();
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}x`);
    expect(res.status).toBe(401);
    expect(res.body.error.details.reason).toBe("TOKEN_INVALID");
  });

  it("rejects a user blocked after signing in, without waiting for the token to expire", async () => {
    const { agent, user } = await signedInAgent();
    await prisma.user.update({ where: { id: user.id }, data: { isBlocked: true } });
    expect((await agent.get("/api/v1/auth/me")).status).toBe(403);
  });
});

describe("POST /auth/refresh", () => {
  it("rotates the refresh token", async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post("/api/v1/auth/refresh");
    expect(res.status).toBe(200);
    expect(cookieValue(res, "refresh_token")).toBeTruthy();
    expect((await agent.get("/api/v1/auth/me")).status).toBe(200);
  });

  it("revokes every session when an old refresh token is replayed (theft detection)", async () => {
    const user = await createUser();
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const stolen = cookieValue(login, "refresh_token")!;

    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${stolen}`);
    expect(first.status).toBe(200);
    const fresh = cookieValue(first, "refresh_token")!;

    // Attacker replays the original token…
    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${stolen}`);
    expect(replay.status).toBe(401);
    // …which also kills the legitimate user's newer session.
    const legit = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${fresh}`);
    expect(legit.status).toBe(401);
  });

  it("returns 401 without a refresh cookie", async () => {
    expect((await request(app).post("/api/v1/auth/refresh")).status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the refresh token and clears cookies", async () => {
    const user = await createUser();
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });
    const refresh = cookieValue(login, "refresh_token")!;

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", `refresh_token=${refresh}`);
    expect(res.status).toBe(204);
    expect(cookieValue(res, "access_token")).toBe("");

    const record = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: sha256(refresh) },
    });
    expect(record.revokedAt).not.toBeNull();
  });
});

describe("email verification", () => {
  it("verifies with the emailed token, which then cannot be reused", async () => {
    const email = uniqueEmail("verify");
    await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Sara", email, password: PASSWORD });
    const token = tokenFromEmail(email);

    const res = await request(app).post("/api/v1/auth/verify-email").send({ token });
    expect(res.status).toBe(200);
    expect(res.body.data.emailVerified).toBe(true);

    const again = await request(app).post("/api/v1/auth/verify-email").send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects expired tokens", async () => {
    const email = uniqueEmail("expired");
    await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Sara", email, password: PASSWORD });
    const token = tokenFromEmail(email);
    await prisma.authToken.update({
      where: { tokenHash: sha256(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await request(app).post("/api/v1/auth/verify-email").send({ token })).status).toBe(400);
  });
});

describe("password reset", () => {
  it("responds the same for unknown emails and sends nothing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: uniqueEmail() });
    expect(res.status).toBe(204);
    expect(testOutbox).toHaveLength(0);
  });

  it("resets the password, signs out all sessions, and the token works once", async () => {
    const { agent, user } = await signedInAgent();
    await request(app).post("/api/v1/auth/forgot-password").send({ email: user.email });
    const token = tokenFromEmail(user.email);

    const res = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, password: "NewHoodie456" });
    expect(res.status).toBe(204);

    expect((await agent.post("/api/v1/auth/refresh")).status).toBe(401);
    const oldLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "NewHoodie456" });
    expect(newLogin.status).toBe(200);

    const reuse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, password: "Another789X" });
    expect(reuse.status).toBe(400);
  });
});

describe("GET /auth/session", () => {
  it("returns null (200) for guests and the user when signed in", async () => {
    const guest = await request(app).get("/api/v1/auth/session");
    expect(guest.status).toBe(200);
    expect(guest.body.data).toBeNull();

    const { agent, user } = await signedInAgent();
    expect((await agent.get("/api/v1/auth/session")).body.data.id).toBe(user.id);
  });
});
