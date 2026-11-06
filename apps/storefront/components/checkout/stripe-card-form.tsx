"use client";

import { formatMoney } from "@hoodie/types";
import { Button } from "@hoodie/ui";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";

const stripeCache = new Map<string, Promise<Stripe | null>>();
const getStripe = (key: string) => {
  if (!stripeCache.has(key)) stripeCache.set(key, loadStripe(key));
  return stripeCache.get(key)!;
};

function Form({
  amount,
  returnUrl,
  onPaid,
}: {
  amount: number;
  returnUrl: string;
  onPaid: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    // Cards that need 3-D Secure redirect to returnUrl; others resolve here.
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    setPending(false);
    if (result.error) setError(result.error.message ?? "Payment failed. Please try another card.");
    else onPaid();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentElement />
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-lg p-3 text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!stripe}>
        Pay {formatMoney(amount)}
      </Button>
    </form>
  );
}

/** Stripe Payment Element: card details go straight to Stripe and never touch our servers. */
export function StripeCardForm({
  publishableKey,
  clientSecret,
  amount,
  returnUrl,
  onPaid,
}: {
  publishableKey: string;
  clientSecret: string;
  amount: number;
  returnUrl: string;
  onPaid: () => void;
}) {
  const stripePromise = useMemo(() => getStripe(publishableKey), [publishableKey]);
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#111111" } },
      }}
    >
      <Form amount={amount} returnUrl={returnUrl} onPaid={onPaid} />
    </Elements>
  );
}
