"use client";

import { newsletterSchema } from "@hoodie/validation";
import { Button, Input } from "@hoodie/ui";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = newsletterSchema.safeParse({ email });
    if (!parsed.success) return toast.error("Enter a valid email address");
    setPending(true);
    try {
      await api("/newsletter", { method: "POST", body: parsed.data });
      toast.success("You're on the list!");
      setEmail("");
    } catch {
      toast.error("Could not subscribe right now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex gap-2">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <Input
        id="newsletter-email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <Button type="submit" loading={pending}>
        Subscribe
      </Button>
    </form>
  );
}
