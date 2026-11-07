import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../../config/env";
import { randomToken } from "../../lib/crypto";

/**
 * Google sign-in (OpenID Connect, authorization code flow with PKCE).
 * The token exchange and ID-token check sit behind `googleClient` so tests can
 * replace them without calling Google.
 */

export const googleEnabled = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const googleRedirectUri = () => `${env.API_PUBLIC_URL}/api/v1/auth/google/callback`;

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

const pkceChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

/** Where to send the browser, plus the values to keep (in a cookie) for the callback. */
export function authorizationRequest() {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, verifier };
}

const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const googleClient = {
  /** Exchanges the authorization code for Google's ID token. */
  async exchangeCode(code: string, verifier: string): Promise<string> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { id_token?: string; error?: string };
    if (!res.ok || !json.id_token) throw new Error(`Google token exchange failed: ${json.error}`);
    return json.id_token;
  },

  /** Verifies the ID token's signature, issuer, audience and expiry. */
  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: env.GOOGLE_CLIENT_ID!,
    });
    if (!payload.sub || typeof payload.email !== "string") throw new Error("Incomplete profile");
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name:
        typeof payload.name === "string" && payload.name
          ? payload.name
          : payload.email.split("@")[0]!,
    };
  },
};
