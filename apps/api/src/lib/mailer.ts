import nodemailer, { type Transporter } from "nodemailer";
import { isTest } from "../config/env";
import { queue } from "../jobs/queue";
import { background } from "./background";
import { loadEmailConfig, type EmailConfig } from "./email-config";
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

async function sendWithResend(config: Extract<EmailConfig, { provider: "resend" }>, mail: Mail) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.from, ...mail }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
}

// One SMTP connection pool per configuration.
let smtp: { key: string; transporter: Transporter } | null = null;

function smtpTransport(config: Extract<EmailConfig, { provider: "smtp" }>): Transporter {
  const key = JSON.stringify(config.smtp);
  if (smtp?.key !== key) {
    smtp?.transporter.close();
    smtp = {
      key,
      transporter: nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    };
  }
  return smtp.transporter;
}

/** Sends with a specific configuration (also used by "Send test email"). Throws on failure. */
export async function sendWith(config: EmailConfig, mail: Mail): Promise<void> {
  if (config.provider === "resend") return sendWithResend(config, mail);
  await smtpTransport(config).sendMail({ from: config.from, ...mail });
}

/**
 * Sends an email now. Throws on failure, so the email job can be retried.
 * Returns false (without sending) while email isn't set up in the admin.
 */
export async function deliverMail(mail: Mail): Promise<boolean> {
  if (isTest) {
    testOutbox.push(mail);
    return true;
  }
  const config = await loadEmailConfig();
  if (!config) {
    logger.info({ to: mail.to, subject: mail.subject }, "Email not sent: email isn't set up yet");
    return false;
  }
  await sendWith(config, mail);
  return true;
}

/**
 * Sends a transactional email. Never throws: a failed email must not fail the
 * request that triggered it. Nothing is sent until email is configured in
 * Store settings → Email. With Redis the email is queued and retried with
 * backoff; otherwise it is sent straight away (and on Vercel the function
 * stays alive until it has gone).
 */
export function sendMail(mail: Mail): Promise<void> {
  return background(send(mail));
}

async function send(mail: Mail): Promise<void> {
  try {
    if (!isTest && !(await loadEmailConfig())) {
      logger.info({ to: mail.to, subject: mail.subject }, "Email not sent: email isn't set up yet");
      return;
    }
    if (queue) await queue.add("email", mail, EMAIL_JOB);
    else await deliverMail(mail);
  } catch (err) {
    logger.error({ err, to: mail.to, subject: mail.subject }, "Failed to send email");
  }
}
