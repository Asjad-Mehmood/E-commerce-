"use client";

import type { ApiResponse } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { Button, Field, Input } from "@hoodie/ui";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

const TEST_CARDS = [
  { number: "4242 4242 4242 4242", label: "Succeeds" },
  { number: "4000 0000 0000 0002", label: "Declined" },
  { number: "4000 0000 0000 9995", label: "Insufficient funds" },
];

const formatCard = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

interface Result {
  status: "succeeded" | "failed";
  message: string | null;
}

/**
 * Card form for demo payment mode (no Stripe keys configured). Only Stripe's
 * public test cards are accepted, by the API too. Never enter a real card.
 */
export function DemoCardForm({
  clientSecret,
  amount,
  onPaid,
}: {
  clientSecret: string;
  amount: number;
  onPaid: () => void;
}) {
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (card.replace(/\s/g, "").length < 15) return setError("Enter a card number");
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError("Enter the expiry date as MM/YY");
    if (!/^\d{3,4}$/.test(cvc)) return setError("Enter the 3 digit security code");
    setPending(true);
    try {
      const { data } = await api<ApiResponse<Result>>("/payments/demo/confirm", {
        method: "POST",
        body: { clientSecret, cardNumber: card, expiry, cvc },
      });
      if (data.status === "succeeded") onPaid();
      else setError(data.message ?? "Payment failed. Please try another card.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Payment failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div role="note" className="bg-warning/15 border-warning/40 rounded-lg border p-4 text-sm">
        <p className="font-semibold">Demo payment mode: no real money is taken.</p>
        <p className="mt-1">
          Use a Stripe test card with any future expiry date and any CVC.{" "}
          <strong>Never enter a real card here.</strong>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TEST_CARDS.map((c) => (
            <button
              key={c.number}
              type="button"
              onClick={() => {
                setCard(c.number);
                setExpiry("12/34");
                setCvc("123");
                setError(null);
              }}
              className="border-line bg-canvas hover:border-ink rounded-lg border px-2.5 py-1.5 text-left text-xs"
            >
              <span className="block font-mono">{c.number}</span>
              <span className="text-muted">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-lg p-3 text-sm">
          {error}
        </p>
      )}

      <Field label="Card number" htmlFor="card-number">
        <Input
          id="card-number"
          inputMode="numeric"
          autoComplete="off"
          placeholder="4242 4242 4242 4242"
          value={card}
          onChange={(e) => setCard(formatCard(e.target.value))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Expiry (MM/YY)" htmlFor="card-expiry">
          <Input
            id="card-expiry"
            inputMode="numeric"
            autoComplete="off"
            placeholder="12/34"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
          />
        </Field>
        <Field label="CVC" htmlFor="card-cvc">
          <Input
            id="card-cvc"
            inputMode="numeric"
            autoComplete="off"
            placeholder="123"
            maxLength={4}
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Pay {formatMoney(amount)}
      </Button>
    </form>
  );
}
