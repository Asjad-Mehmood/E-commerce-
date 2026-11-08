import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";

/**
 * Encrypts secrets kept in the database (e.g. the SMTP password entered in the
 * admin settings) with AES-256-GCM. The key comes from SETTINGS_SECRET, or is
 * derived from JWT_ACCESS_SECRET. Changing that secret makes stored values
 * unreadable, and they then have to be entered again.
 */
const key = () =>
  createHash("sha256")
    .update(`settings:${env.SETTINGS_SECRET ?? env.JWT_ACCESS_SECRET}`)
    .digest();

const PREFIX = "enc:v1:";

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

/** Returns null if the value is missing or can no longer be decrypted. */
export function decryptSecret(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
