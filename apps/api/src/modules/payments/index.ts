import { env } from "../../config/env";
import { DemoProvider } from "./demo.provider";
import type { PaymentProvider } from "./provider";
import { StripeProvider } from "./stripe.provider";

export type { PaymentEvent, PaymentProvider } from "./provider";
export { DemoProvider, StripeProvider };

let cached: PaymentProvider | null | undefined;

/**
 * The active card payment provider:
 * - Stripe when STRIPE_SECRET_KEY is set;
 * - otherwise the demo provider, unless in production without ALLOW_DEMO_PAYMENTS
 *   (then card payments are unavailable and only Cash on Delivery is offered).
 */
export function getPaymentProvider(): PaymentProvider | null {
  if (cached !== undefined) return cached;
  if (env.STRIPE_SECRET_KEY) {
    cached = new StripeProvider(
      env.STRIPE_SECRET_KEY,
      env.STRIPE_PUBLISHABLE_KEY ?? null,
      env.STRIPE_WEBHOOK_SECRET!,
    );
  } else if (env.ALLOW_DEMO_PAYMENTS) {
    cached = new DemoProvider(env.JWT_ACCESS_SECRET);
  } else {
    cached = null;
  }
  return cached;
}

/** Tests only: swap the provider. */
export function setPaymentProviderForTests(provider: PaymentProvider | null | undefined) {
  cached = provider;
}

export const demoPaymentsActive = () => getPaymentProvider()?.name === "demo";
