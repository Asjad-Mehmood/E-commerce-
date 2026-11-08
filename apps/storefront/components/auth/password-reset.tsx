"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, resetPasswordSchema } from "@hoodie/validation";
import { Button, Field, Input } from "@hoodie/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuthProviders } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { applyApiError } from "@/lib/forms";
import { FormMessage } from "./auth-card";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) });
  const providers = useAuthProviders();

  if (providers.data && !providers.data.email) {
    return (
      <FormMessage tone="info">
        We can&apos;t email reset links at the moment.{" "}
        <Link href="/contact" className="underline">
          Contact us
        </Link>{" "}
        with the email address on your account and we&apos;ll help you sign in.
      </FormMessage>
    );
  }

  if (sentTo) {
    return (
      <FormMessage tone="success">
        If an account exists for <strong>{sentTo}</strong>, we’ve emailed a link to reset your
        password. It expires in 1 hour.
      </FormMessage>
    );
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        try {
          await api("/auth/forgot-password", { method: "POST", body: values });
          setSentTo(values.email);
        } catch (err) {
          setFormError(applyApiError(err, setError));
        }
      })}
    >
      {formError && <FormMessage>{formError}</FormMessage>}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          invalid={!!errors.email}
          {...register("email")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  if (!token) {
    return (
      <FormMessage>
        This reset link is incomplete.{" "}
        <Link href="/forgot-password" className="underline">
          Request a new one
        </Link>
        .
      </FormMessage>
    );
  }
  if (done) {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">
          Your password has been changed. For your security, you’ve been signed out everywhere.
        </FormMessage>
        <Link
          href="/login"
          className="bg-ink inline-flex h-11 items-center rounded-lg px-6 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        try {
          await api("/auth/reset-password", { method: "POST", body: values });
          setDone(true);
        } catch (err) {
          setFormError(applyApiError(err, setError));
        }
      })}
    >
      {formError && (
        <FormMessage>
          {formError}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
          .
        </FormMessage>
      )}
      <input type="hidden" {...register("token")} />
      <Field
        label="New password"
        htmlFor="password"
        error={errors.password?.message}
        hint="At least 8 characters, with upper and lower case letters and a number."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Set new password
      </Button>
    </form>
  );
}
