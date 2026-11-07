"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ApiResponse, AuthUser } from "@hoodie/types";
import { changePasswordSchema, updateProfileSchema } from "@hoodie/validation";
import { Button, Field, Input } from "@hoodie/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { meKey, useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { applyApiError } from "@/lib/forms";
import { FormMessage } from "../auth/auth-card";

export function ProfileForm() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(updateProfileSchema),
    values: { name: me?.name ?? "", phone: me?.phone ?? null },
  });

  return (
    <section aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="text-xl font-semibold">
        Profile
      </h2>
      <form
        noValidate
        className="mt-4 space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          try {
            const { data } = await api<ApiResponse<AuthUser>>("/me", {
              method: "PATCH",
              body: values,
            });
            qc.setQueryData(meKey, data);
            reset({ name: data.name, phone: data.phone });
            toast.success("Profile saved");
          } catch (err) {
            setFormError(applyApiError(err, setError));
          }
        })}
      >
        {formError && <FormMessage>{formError}</FormMessage>}
        <Field
          label="Email"
          htmlFor="profile-email"
          hint="Contact us to change your email address."
        >
          <Input id="profile-email" value={me?.email ?? ""} disabled readOnly />
        </Field>
        <Field label="Full name" htmlFor="profile-name" error={errors.name?.message}>
          <Input
            id="profile-name"
            autoComplete="name"
            invalid={!!errors.name}
            {...register("name")}
          />
        </Field>
        <Field label="Phone" htmlFor="profile-phone" error={errors.phone?.message}>
          <Input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            invalid={!!errors.phone}
            {...register("phone", { setValueAs: (v: string | null) => (v ? v : null) })}
          />
        </Field>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
      </form>
    </section>
  );
}

export function PasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
  });

  return (
    <section aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-xl font-semibold">
        Change password
      </h2>
      <p className="text-muted mt-1 text-sm">
        You’ll stay signed in here, and be signed out on other devices.
      </p>
      <form
        noValidate
        className="mt-4 space-y-5"
        onSubmit={handleSubmit(async (values) => {
          setFormError(null);
          try {
            await api("/auth/password", { method: "PATCH", body: values });
            reset({ currentPassword: "", newPassword: "" });
            toast.success("Password changed");
          } catch (err) {
            setFormError(applyApiError(err, setError));
          }
        })}
      >
        {formError && <FormMessage>{formError}</FormMessage>}
        <Field
          label="Current password"
          htmlFor="current-password"
          error={errors.currentPassword?.message}
        >
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.currentPassword}
            {...register("currentPassword")}
          />
        </Field>
        <Field
          label="New password"
          htmlFor="new-password"
          error={errors.newPassword?.message}
          hint="At least 8 characters, with upper and lower case letters and a number."
        >
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.newPassword}
            {...register("newPassword")}
          />
        </Field>
        <Button type="submit" loading={isSubmitting}>
          Change password
        </Button>
      </form>
    </section>
  );
}
