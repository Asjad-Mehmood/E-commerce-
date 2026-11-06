import { env, isTest } from "../config/env";
import { logger } from "./logger";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Emails "sent" during tests, so tests can read verification/reset links. */
export const testOutbox: Mail[] = [];

async function sendWithResend(mail: Mail) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, ...mail }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
}

/**
 * Sends a transactional email. Never throws: a failed email must not fail the
 * request that triggered it. (Phase 3 moves sending onto a BullMQ queue with retries.)
 *
 * Transports: tests → in-memory outbox; RESEND_API_KEY set → Resend; otherwise the
 * email is printed to the API log so links can be clicked during development.
 */
export async function sendMail(mail: Mail): Promise<void> {
  try {
    if (isTest) {
      testOutbox.push(mail);
    } else if (env.RESEND_API_KEY) {
      await sendWithResend(mail);
    } else {
      logger.info(`📧 Email to ${mail.to}: "${mail.subject}"\n${mail.text}`);
    }
  } catch (err) {
    logger.error({ err, to: mail.to, subject: mail.subject }, "Failed to send email");
  }
}
