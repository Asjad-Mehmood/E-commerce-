import { env } from "../../config/env";
import { emailLayout, esc } from "../../lib/email-layout";
import type { Mail } from "../../lib/mailer";
import { unsubscribeLink } from "../../lib/signed";

export function newsletterWelcomeEmail(email: string): Mail {
  const stop = unsubscribeLink("newsletter", email);
  return {
    to: email,
    subject: "You're on the list",
    text: `Thanks for subscribing! You'll be the first to hear about new drops and sales.\n${env.STOREFRONT_URL}\n\nUnsubscribe: ${stop}\n`,
    html: emailLayout(
      "You're on the list",
      "<p>Thanks for subscribing! You'll be the first to hear about new drops and sales.</p>",
      { label: "Browse new arrivals", url: `${env.STOREFRONT_URL}/shop` },
      `<a href="${esc(stop)}" style="color:#888">Unsubscribe</a>`,
    ),
  };
}
