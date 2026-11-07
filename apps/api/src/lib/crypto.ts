import { createHash, randomBytes } from "node:crypto";

/** URL-safe random token (default 32 bytes = 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest. Tokens are stored hashed so a database leak cannot be replayed. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
