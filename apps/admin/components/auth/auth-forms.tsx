"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, passwordSchema } from "@hoodie/validation";
import { Button, Field, Input } from "@hoodie/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { NotStaffError, useLogin, useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { adminConfig } from "@/lib/config";
import { applyApiError } from "@/lib/forms";

/** Only same-site paths, so ?next= cannot send people to another website. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="border-line bg-canvas w-full max-w-sm rounded-2xl border p-6 shadow-sm sm:p-8">
        <p className="font-black uppercase tracking-tight">Hoodie Admin</p>
        <h1 className="mt-6 text-xl font-bold">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

function FormMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">
      {children}
    </p>
  );
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const session = useSession();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  // Already signed in as staff: go straight in.
  const staff = session.data && session.data.role !== "CUSTOMER";
  useEffect(() => {
    if (staff) router.replace(next);
  }, [staff, next, router]);

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => router.replace(next),
      onError: (err) =>
        setFormError(err instanceof NotStaffError ? err.message : applyApiError(err, setError)),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <FormMessage>{formError}</FormMessage>}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
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
      <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
        Sign in
      </Button>
      <p className="text-muted text-center text-sm">
        Forgot your password?{" "}
        <a href={`${adminConfig.storefrontUrl}/forgot-password`} className="text-ink underline">
          Reset it
        </a>
      </p>
    </form>
  );
}

const setPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: "The passwords don't match",
    path: ["confirm"],
  });

/** Staff invitation: choose a password with the emailed token, then sign in. */
export function SetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(setPasswordSchema) });

  if (!token) {
    return (
      <FormMessage>This link is missing its token. Open the link from your email.</FormMessage>
    );
  }
  if (done) {
    return (
      <div className="space-y-4 text-sm">
        <p>Your password is set. You can now sign in.</p>
        <Link
          href="/login"
          className="bg-ink inline-flex h-10 w-full items-center justify-center rounded-lg font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      setFormError(applyApiError(err, setError));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <FormMessage>{formError}</FormMessage>}
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
      <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.confirm}
          {...register("confirm")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Set password
      </Button>
    </form>
  );
}
