import { env } from "../../config/env";
import { emailLayout } from "../../lib/email-layout";
import type { Mail } from "../../lib/mailer";

const STORE = "Hoodie Store";
const layout = (title: string, body: string, cta: { label: string; url: string }) =>
  emailLayout(title, `<p style="color:#444;line-height:1.5">${body}</p>`, cta);

export function verificationEmail(to: string, name: string, token: string): Mail {
  const url = `${env.STOREFRONT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: `Verify your email for ${STORE}`,
    text: `Hi ${name},\n\nConfirm your email address by opening this link (valid for 24 hours):\n${url}\n`,
    html: layout(
      `Welcome, ${name}!`,
      "Confirm your email address to finish setting up your account. This link is valid for 24 hours.",
      { label: "Verify email", url },
    ),
  };
}

export function passwordResetEmail(to: string, name: string, token: string): Mail {
  const url = `${env.STOREFRONT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: `Reset your ${STORE} password`,
    text: `Hi ${name},\n\nReset your password with this link (valid for 1 hour):\n${url}\n\nIf you did not ask for this, you can ignore this email.\n`,
    html: layout(
      "Reset your password",
      "We received a request to reset your password. This link is valid for 1 hour. If you did not ask for this, you can ignore this email.",
      { label: "Reset password", url },
    ),
  };
}
