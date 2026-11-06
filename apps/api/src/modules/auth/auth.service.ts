import type { AuthUser } from "@hoodie/types";
import type { LoginInput, RegisterInput, ResetPasswordInput } from "@hoodie/validation";
import { ErrorCode } from "@hoodie/types";
import type { AuthTokenType, User } from "@prisma/client";
import { hash, verify } from "argon2";
import { env } from "../../config/env";
import { randomToken, sha256 } from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { passwordResetEmail, verificationEmail } from "./auth.emails";

const HOUR = 60 * 60 * 1000;
const TOKEN_TTL: Record<AuthTokenType, number> = {
  EMAIL_VERIFICATION: 24 * HOUR,
  PASSWORD_RESET: HOUR,
};

export interface Session {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function createSession(user: User, client: ClientInfo): Promise<Session> {
  const refreshToken = randomToken(48);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: client.userAgent?.slice(0, 300),
      ip: client.ip,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * HOUR),
    },
  });
  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  return { user: toAuthUser(user), accessToken, refreshToken };
}

async function issueToken(userId: string, type: AuthTokenType): Promise<string> {
  // Only the newest token of each type is valid.
  await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  const token = randomToken();
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL[type]),
    },
  });
  return token;
}

/** Marks a one-time token as used and returns its user id. Throws if invalid/expired/used. */
async function consumeToken(token: string, type: AuthTokenType): Promise<string> {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(ErrorCode.INVALID_TOKEN, "This link is invalid or has expired");
  }
  // Conditional update so the same token cannot be used twice concurrently.
  const { count } = await prisma.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) throw new AppError(ErrorCode.INVALID_TOKEN, "This link has already been used");
  return record.userId;
}

// A real argon2 hash, verified when the email is unknown so response time does
// not reveal whether an account exists.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hash("not-a-real-password-0000"));

export async function register(input: RegisterInput, client: ClientInfo): Promise<Session> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict("An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone,
      passwordHash: await hash(input.password),
    },
  });

  const token = await issueToken(user.id, "EMAIL_VERIFICATION");
  void sendMail(verificationEmail(user.email, user.name, token));

  return createSession(user, client);
}

export async function login(input: LoginInput, client: ClientInfo): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  const valid = user?.passwordHash
    ? await verify(user.passwordHash, input.password)
    : (await verify(await getDummyHash(), input.password), false);

  if (!user || !valid) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Incorrect email or password");
  }
  if (user.isBlocked) {
    throw new AppError(ErrorCode.ACCOUNT_BLOCKED, "This account has been blocked");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return createSession(user, client);
}

/**
 * Rotates the refresh token: the presented token is revoked and a new pair issued.
 * If an already-revoked token is presented, it was probably stolen and replayed,
 * so every session for that user is revoked.
 */
export async function refresh(
  refreshToken: string | undefined,
  client: ClientInfo,
): Promise<Session> {
  if (!refreshToken) throw AppError.unauthorized("No session");

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshToken) },
    include: { user: true },
  });
  if (!record) throw AppError.unauthorized("Invalid session");

  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized("Session expired, please sign in again");
  }
  if (record.expiresAt < new Date())
    throw AppError.unauthorized("Session expired, please sign in again");
  if (record.user.isBlocked) {
    throw new AppError(ErrorCode.ACCOUNT_BLOCKED, "This account has been blocked");
  }

  const { count } = await prisma.refreshToken.updateMany({
    where: { id: record.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw AppError.unauthorized("Session expired, please sign in again");

  return createSession(record.user, client);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("User");
  return toAuthUser(user);
}

export async function verifyEmail(token: string): Promise<AuthUser> {
  const userId = await consumeToken(token, "EMAIL_VERIFICATION");
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
  return toAuthUser(user);
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerified) throw AppError.badRequest("Your email is already verified");
  const token = await issueToken(user.id, "EMAIL_VERIFICATION");
  void sendMail(verificationEmail(user.email, user.name, token));
}

/** Always succeeds, so the response never reveals whether the email has an account. */
export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isBlocked) return;
  const token = await issueToken(user.id, "PASSWORD_RESET");
  void sendMail(passwordResetEmail(user.email, user.name, token));
}

/** Sets a new password and signs out every existing session. */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const userId = await consumeToken(input.token, "PASSWORD_RESET");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      // Proving access to the inbox also verifies the email.
      data: { passwordHash: await hash(input.password), emailVerified: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

/** Changes the password and signs out all OTHER sessions (keeps the current device signed in). */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentRefreshToken: string | undefined,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash || !(await verify(user.passwordHash, currentPassword))) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Current password is incorrect", {
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(newPassword) } }),
    prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentRefreshToken ? { tokenHash: { not: sha256(currentRefreshToken) } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);
}
