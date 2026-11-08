"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { contactMessageSchema } from "@hoodie/validation";
import { Button, Field, Input } from "@hoodie/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { applyApiError } from "@/lib/forms";
import { FormMessage } from "../auth/auth-card";

export function ContactForm() {
  const { data: me } = useMe();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(contactMessageSchema),
    values: { name: me?.name ?? "", email: me?.email ?? "", subject: "", message: "" },
  });

  if (sent)
    return (
      <FormMessage tone="success">
        Thanks! Your message has been sent. We’ll get back to you soon.
      </FormMessage>
    );

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        try {
          await api("/contact", { method: "POST", body: values });
          setSent(true);
        } catch (err) {
          setFormError(applyApiError(err, setError));
        }
      })}
    >
      {formError && <FormMessage>{formError}</FormMessage>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="contact-name" error={errors.name?.message}>
          <Input
            id="contact-name"
            autoComplete="name"
            invalid={!!errors.name}
            {...register("name")}
          />
        </Field>
        <Field label="Email" htmlFor="contact-email" error={errors.email?.message}>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
      </div>
      <Field label="Subject (optional)" htmlFor="contact-subject" error={errors.subject?.message}>
        <Input id="contact-subject" placeholder="e.g. Order US-10025" {...register("subject")} />
      </Field>
      <Field label="Message" htmlFor="contact-message" error={errors.message?.message}>
        <textarea
          id="contact-message"
          rows={6}
          aria-invalid={!!errors.message || undefined}
          className="border-line focus:border-ink focus:ring-ink/10 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          {...register("message")}
        />
      </Field>
      <Button type="submit" size="lg" loading={isSubmitting}>
        Send message
      </Button>
    </form>
  );
}
