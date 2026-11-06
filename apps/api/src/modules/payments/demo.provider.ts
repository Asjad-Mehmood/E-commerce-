import { createHmac, timingSafeEqual } from "node:crypto";
import { randomToken } from "../../lib/crypto";
import { AppError } from "../../utils/app-error";
import type { PaymentEvent, PaymentProvider } from "./provider";

/**
 * Stripe's public test card numbers and what each one does.
 * https://docs.stripe.com/testing
 */
export const DEMO_TEST_CARDS: Record<
  string,
  { outcome: "succeeded" } | { outcome: "failed"; reason: string }
> = {
  "4242424242424242": { outcome: "succeeded" }, // Visa
  "5555555555554444": { outcome: "succeeded" }, // Mastercard
  "4000056655665556": { outcome: "succeeded" }, // Visa debit
  "4000000000000002": { outcome: "failed", reason: "Your card was declined." },
  "4000000000009995": { outcome: "failed", reason: "Your card has insufficient funds." },
  "4000000000000069": { outcome: "failed", reason: "Your card has expired." },
  "4000000000000127": { outcome: "failed", reason: "Your card's security code is incorrect." },
};

/**
 * Built-in stand-in for Stripe test mode, used when no Stripe keys are configured.
 * It never moves money and only accepts Stripe's published test card numbers,
 * so a real card number is rejected rather than processed.
 */
export class DemoProvider implements PaymentProvider {
  readonly name = "demo" as const;
  readonly publishableKey = null;

  constructor(private readonly secret: string) {}

  private sign(intentId: string): string {
    return createHmac("sha256", this.secret)
      .update(`demo-intent:${intentId}`)
      .digest("base64url")
      .slice(0, 32);
  }

  async createIntent() {
    const id = `pi_demo_${randomToken(12)}`;
    return { id, clientSecret: await this.getClientSecret(id) };
  }

  async getClientSecret(intentId: string) {
    return `${intentId}_secret_${this.sign(intentId)}`;
  }

  async cancelIntent() {}

  /** Returns the intent id if the client secret is genuine. */
  verifyClientSecret(clientSecret: string): string | null {
    const match = /^(pi_demo_[\w-]+)_secret_([\w-]+)$/.exec(clientSecret);
    if (!match) return null;
    const [, intentId, sig] = match as unknown as [string, string, string];
    const expected = Buffer.from(this.sign(intentId));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given) ? intentId : null;
  }

  /** Simulates the card being charged: returns the event Stripe would send. */
  charge(
    intentId: string,
    card: { number: string; expiry: string },
    now = new Date(),
  ): PaymentEvent {
    const behaviour = DEMO_TEST_CARDS[card.number];
    if (!behaviour) {
      throw AppError.badRequest(
        "Demo mode only accepts Stripe test cards, e.g. 4242 4242 4242 4242. Never enter a real card here.",
      );
    }
    const [mm, yy] = card.expiry.split("/").map(Number) as [number, number];
    const expired = new Date(2000 + yy, mm, 1) <= now; // valid through the end of the month
    const id = `evt_demo_${randomToken(12)}`;
    if (expired) return { id, type: "failed", intentId, failureReason: "Your card has expired." };
    return behaviour.outcome === "succeeded"
      ? { id, type: "succeeded", intentId }
      : { id, type: "failed", intentId, failureReason: behaviour.reason };
  }
}
