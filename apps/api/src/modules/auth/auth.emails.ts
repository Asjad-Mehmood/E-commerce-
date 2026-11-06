import { env } from "../../config/env";
import type { Mail } from "../../lib/mailer";

const STORE = "Hoodie Store";

function layout(title: string, body: string, cta: { label: string; url: string }) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f6f6f7;padding:24px">
<table role="presentation" style="max-width:520px;margin:auto;background:#fff;border-radius:12px;padding:32px">
<tr><td>
<p style="font-weight:900;letter-spacing:-.02em;text-transform:uppercase">${STORE}</p>
<h1 style="font-size:20px">${title}</h1>
<p style="color:#444;line-height:1.5">${body}</p>
<p><a href="${cta.url}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${cta.label}</a></p>
<p style="color:#888;font-size:12px">If the button does not work, paste this link into your browser:<br>${cta.url}</p>
</td></tr></table></body></html>`;
}

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
