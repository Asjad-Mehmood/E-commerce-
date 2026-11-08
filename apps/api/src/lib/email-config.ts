import { env } from "../config/env";
import { prisma } from "./prisma";
import { decryptSecret } from "./secrets";

/**
 * How emails are sent. Configured by a Super Admin in Store settings → Email
 * (stored in the Setting table, secrets encrypted). Until it is configured, no
 * email is sent at all. RESEND_API_KEY in the environment also counts, as a
 * fallback for server-managed setups.
 */
export type EmailConfig =
  | {
      provider: "smtp";
      from: string;
      smtp: { host: string; port: number; secure: boolean; user: string; password: string };
    }
  | { provider: "resend"; from: string; apiKey: string };

export const EMAIL_KEYS = [
  "email.provider",
  "email.from",
  "email.smtp.host",
  "email.smtp.port",
  "email.smtp.secure",
  "email.smtp.user",
  "email.smtp.password",
  "email.resend.apiKey",
] as const;

export type EmailSettingsRaw = Partial<Record<(typeof EMAIL_KEYS)[number], unknown>>;

export async function readEmailSettings(): Promise<EmailSettingsRaw> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...EMAIL_KEYS] } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The usable configuration from raw settings, or null if email isn't set up. */
export function toEmailConfig(s: EmailSettingsRaw): EmailConfig | null {
  const from = str(s["email.from"]) || env.EMAIL_FROM;
  if (s["email.provider"] === "smtp") {
    const password = decryptSecret(s["email.smtp.password"]);
    const host = str(s["email.smtp.host"]);
    if (!host || password === null) return null;
    return {
      provider: "smtp",
      from,
      smtp: {
        host,
        port: Number(s["email.smtp.port"]) || 587,
        secure: s["email.smtp.secure"] === true,
        user: str(s["email.smtp.user"]),
        password,
      },
    };
  }
  if (s["email.provider"] === "resend") {
    const apiKey = decryptSecret(s["email.resend.apiKey"]);
    return apiKey ? { provider: "resend", from, apiKey } : null;
  }
  if (s["email.provider"] === undefined && env.RESEND_API_KEY) {
    return { provider: "resend", from, apiKey: env.RESEND_API_KEY };
  }
  return null;
}

// Cached briefly: every email (and some pages) ask whether email is set up.
let cache: { at: number; value: EmailConfig | null } | null = null;
const TTL = 30_000;

export async function loadEmailConfig(): Promise<EmailConfig | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const value = toEmailConfig(await readEmailSettings());
  cache = { at: Date.now(), value };
  return value;
}

export const emailEnabled = async () => (await loadEmailConfig()) !== null;

/** Call after the settings change. */
export function clearEmailConfigCache() {
  cache = null;
}
