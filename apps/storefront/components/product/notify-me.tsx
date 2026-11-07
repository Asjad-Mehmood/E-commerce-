"use client";

import { stockAlertSchema } from "@hoodie/validation";
import { Button, Input } from "@hoodie/ui";
import { useState } from "react";
import { useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api";

/** "Email me when it's back" for a sold-out variant. */
export function NotifyMe({ variantId, label }: { variantId: string; label: string }) {
  const me = useMe();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") {
    return (
      <p role="status" className="bg-success/10 text-success rounded-lg p-3 text-sm font-medium">
        Thanks! We’ll email you when {label} is back in stock.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = stockAlertSchema.safeParse({ email: email || me.data?.email, variantId });
    if (!parsed.success) return setError("Enter a valid email address");
    setState("sending");
    setError(null);
    try {
      await api("/stock-alerts", { method: "POST", body: parsed.data });
      setState("done");
    } catch {
      setState("error");
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <p className="text-sm font-medium">{label} is sold out. Get an email when it’s back:</p>
      <div className="flex gap-2">
        <label htmlFor="notify-email" className="sr-only">
          Email address
        </label>
        <Input
          id="notify-email"
          type="email"
          autoComplete="email"
          placeholder={me.data?.email ?? "you@example.com"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={!!error}
        />
        <Button type="submit" variant="outline" loading={state === "sending"}>
          Notify me
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
