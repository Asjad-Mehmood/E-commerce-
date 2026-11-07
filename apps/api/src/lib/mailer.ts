import { env, isTest } from "../config/env";
import { queue } from "../jobs/queue";
import { logger } from "./logger";

/** Email jobs retry for about two hours (30 s, 1 min, 2 min… between attempts). */
const EMAIL_JOB = {
  attempts: 8,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
} as const;

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

/** Sends an email now. Throws on failure, so the email job can be retried. */
export async function deliverMail(mail: Mail): Promise<void> {
  if (isTest) {
    testOutbox.push(mail);
  } else if (env.RESEND_API_KEY) {
    await sendWithResend(mail);
  } else {
    logger.info(`📧 Email to ${mail.to}: "${mail.subject}"\n${mail.text}`);
  }
}

/**
 * Sends a transactional email. Never throws: a failed email must not fail the
 * request that triggered it. With Redis the email is queued and retried with
 * backoff; otherwise it is sent straight away.
 *
 * Transports: tests → in-memory outbox; RESEND_API_KEY set → Resend; otherwise the
 * email is printed to the API log so links can be clicked during development.
 */
export async function sendMail(mail: Mail): Promise<void> {
  try {
    if (queue) await queue.add("email", mail, EMAIL_JOB);
    else await deliverMail(mail);
  } catch (err) {
    logger.error({ err, to: mail.to, subject: mail.subject }, "Failed to send email");
  }
}
