/** What checkout needs from a card payment provider (Stripe, or the built-in demo). */
export interface PaymentProvider {
  readonly name: "stripe" | "demo";
  /** Sent to the browser (Stripe publishable key; null in demo mode). */
  readonly publishableKey: string | null;
  createIntent(input: {
    amount: number;
    currency: string;
    orderNumber: string;
    email: string;
    idempotencyKey: string;
  }): Promise<{ id: string; clientSecret: string }>;
  /** Client secret for an existing intent (to resume payment after a reload). */
  getClientSecret(intentId: string): Promise<string>;
  /** Best-effort: stop an abandoned intent from being paid later. */
  cancelIntent(intentId: string): Promise<void>;
  /** Refunds part or all of a captured payment. Throws if the provider refuses. */
  refund(input: {
    intentId: string;
    amount: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<{ id: string }>;
}

/** A provider event, normalised. Applied at most once (by `id`). */
export interface PaymentEvent {
  id: string;
  type: "succeeded" | "failed";
  intentId: string;
  failureReason?: string;
}
