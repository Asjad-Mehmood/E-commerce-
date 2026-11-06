"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@hoodie/validation";
import { Button, Field, Input } from "@hoodie/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRegister } from "@/hooks/use-auth";
import { applyApiError } from "@/lib/forms";
import { FormMessage, safeNext } from "./auth-card";

export function RegisterForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const registerUser = useRegister();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    registerUser.mutate(
      { ...values, phone: values.phone || undefined },
      {
        onSuccess: () => {
          toast.success("Welcome! Check your inbox to verify your email.");
          router.push(next);
        },
        onError: (err) => setFormError(applyApiError(err, setError)),
      },
    );
  });

  const describe = (name: keyof typeof errors) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <FormMessage>{formError}</FormMessage>}
      <Field label="Full name" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="name"
          invalid={!!errors.name}
          aria-describedby={describe("name")}
          {...register("name")}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          invalid={!!errors.email}
          aria-describedby={describe("email")}
          {...register("email")}
        />
      </Field>
      <Field
        label="Phone (optional)"
        htmlFor="phone"
        error={errors.phone?.message}
        hint="For delivery updates, e.g. 0300 1234567"
      >
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          invalid={!!errors.phone}
          aria-describedby={describe("phone")}
          {...register("phone", { setValueAs: (v: string) => v || undefined })}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        hint="At least 8 characters, with upper and lower case letters and a number."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          aria-describedby={describe("password")}
          {...register("password")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={registerUser.isPending}>
        Create account
      </Button>
    </form>
  );
}
