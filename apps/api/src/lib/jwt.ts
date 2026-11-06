import type { Role } from "@hoodie/types";
import { errors, jwtVerify, SignJWT } from "jose";
import { env } from "../config/env";

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = "hoodie-api";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(secret);
}

export type VerifyResult =
  { ok: true; payload: AccessTokenPayload } | { ok: false; reason: "expired" | "invalid" };

export async function verifyAccessToken(token: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return { ok: false, reason: "invalid" };
    return { ok: true, payload: { sub: payload.sub, role: payload.role as Role } };
  } catch (err) {
    return { ok: false, reason: err instanceof errors.JWTExpired ? "expired" : "invalid" };
  }
}
