import Stripe from "stripe";
import { AppError } from "../../utils/app-error";
import type { PaymentEvent, PaymentProvider } from "./provider";

/** Real Stripe (test or live keys). Payments are confirmed by webhooks, never by the browser. */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    readonly publishableKey: string | null,
    private readonly webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 15_000 });
  }

  async createIntent(input: Parameters<PaymentProvider["createIntent"]>[0]) {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: input.email,
        description: `Order ${input.orderNumber}`,
        metadata: { orderNumber: input.orderNumber },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    if (!intent.client_secret) throw new Error("Stripe returned no client secret");
    return { id: intent.id, clientSecret: intent.client_secret };
  }

  async getClientSecret(intentId: string) {
    const intent = await this.stripe.paymentIntents.retrieve(intentId);
    if (!intent.client_secret) throw new Error("Stripe returned no client secret");
    return intent.client_secret;
  }

  async cancelIntent(intentId: string) {
    await this.stripe.paymentIntents.cancel(intentId).catch(() => undefined);
  }

  /** Verifies the Stripe-Signature header and maps the event. Unrelated events return null. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): PaymentEvent | null {
    if (!signature) throw AppError.badRequest("Missing Stripe-Signature header");
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw AppError.badRequest("Invalid webhook signature");
    }
    if (event.type === "payment_intent.succeeded") {
      return { id: event.id, type: "succeeded", intentId: event.data.object.id };
    }
    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      return {
        id: event.id,
        type: "failed",
        intentId: pi.id,
        failureReason: pi.last_payment_error?.message ?? "Payment failed",
      };
    }
    return null;
  }

  /** Test helper: a valid signature for a payload (uses Stripe's own signing code). */
  signTestPayload(payload: string): string {
    return this.stripe.webhooks.generateTestHeaderString({ payload, secret: this.webhookSecret });
  }
}
