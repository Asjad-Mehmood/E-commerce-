"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@hoodie/validation";
import { Button, Field, Input } from "@hoodie/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLogin } from "@/hooks/use-auth";
import { applyApiError } from "@/lib/forms";
import { FormMessage, safeNext } from "./auth-card";

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => router.push(next),
      onError: (err) => setFormError(applyApiError(err, setError)),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <FormMessage>{formError}</FormMessage>}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
      </Field>
      <div className="text-right">
        <Link href="/forgot-password" className="text-sm underline">
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
        Sign in
      </Button>
    </form>
  );
}
