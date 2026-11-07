import { ErrorCode, hasRole, type Role } from "@hoodie/types";
import type { Request, RequestHandler } from "express";
import { COOKIE } from "../lib/cookies";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augments its types via this global namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE.access];
  return cookie || undefined;
}

/**
 * Resolves the current user from the access token (cookie or Bearer header).
 * The user is re-read from the database on every request, so blocking a user or
 * changing their role takes effect immediately rather than when the token expires.
 */
async function resolveUser(req: Request): Promise<CurrentUser | undefined> {
  const token = readToken(req);
  if (!token) return undefined;

  const result = await verifyAccessToken(token);
  if (!result.ok) {
    throw new AppError(
      ErrorCode.UNAUTHORIZED,
      result.reason === "expired" ? "Session expired, please refresh" : "Invalid session",
      { reason: result.reason === "expired" ? "TOKEN_EXPIRED" : "TOKEN_INVALID" },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: result.payload.sub },
    select: { id: true, email: true, name: true, role: true, emailVerified: true, isBlocked: true },
  });
  if (!user) throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid session");
  if (user.isBlocked)
    throw new AppError(ErrorCode.ACCOUNT_BLOCKED, "This account has been blocked");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified !== null,
  };
}

/** Requires a signed-in user. 401 otherwise. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) throw AppError.unauthorized();
  req.user = user;
  next();
};

/**
 * Signs the user in if a token is present, otherwise continues as a guest.
 * An expired/invalid token still returns 401 so the client refreshes instead of
 * silently acting as a guest (e.g. adding to the wrong cart).
 */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  req.user = await resolveUser(req);
  next();
};

/** Requires at least `minRole` (roles are ranked: SUPPORT < MANAGER < SUPER_ADMIN). */
export const authorize =
  (minRole: Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!hasRole(req.user.role, minRole)) throw AppError.forbidden();
    next();
  };

/** The signed-in user. Only call from routes that use `authenticate`. */
export function currentUser(req: Request): CurrentUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
