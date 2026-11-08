"use client";

import type { ApiResponse, EmailSettingsDTO } from "@hoodie/types";
import { Badge, Button, Field, Input, Skeleton } from "@hoodie/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Select, Switch } from "@/admin/components/ui/controls";
import { ErrorState, PageHeader, Section } from "@/admin/components/ui/page";
import { useSession } from "@/admin/hooks/use-session";
import { api, errorMessage } from "@/admin/lib/api";
import { applyApiError } from "@/admin/lib/forms";

type Provider = EmailSettingsDTO["provider"];

interface FormValues {
  provider: Provider;
  from: string;
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  apiKey: string;
}

const PRESETS: { label: string; host: string; port: number; secure: boolean }[] = [
  { label: "Gmail", host: "smtp.gmail.com", port: 465, secure: true },
  { label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, secure: false },
  { label: "Zoho Mail", host: "smtp.zoho.com", port: 465, secure: true },
  { label: "Hostinger", host: "smtp.hostinger.com", port: 465, secure: true },
];

const toForm = (s: EmailSettingsDTO): FormValues => ({
  provider: s.provider,
  from: s.from,
  host: s.smtp.host,
  port: String(s.smtp.port),
  secure: s.smtp.secure,
  user: s.smtp.user,
  password: "",
  apiKey: "",
});

const QUERY_KEY = ["admin", "settings", "email"];

export function EmailSettings() {
  const qc = useQueryClient();
  const { data: user } = useSession();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await api<ApiResponse<EmailSettingsDTO>>("/admin/settings/email")).data,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, setValue, watch, formState } =
    useForm<FormValues>();
  const provider = watch("provider");

  useEffect(() => {
    if (query.data) reset(toForm(query.data));
  }, [query.data, reset]);

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api<ApiResponse<EmailSettingsDTO>>("/admin/settings/email", { method: "PUT", body }))
        .data,
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEY, data);
      void qc.invalidateQueries({ queryKey: ["admin", "settings"], exact: true });
      reset(toForm(data));
      toast.success(data.configured ? "Email settings saved" : "Email turned off");
    },
    onError: (err) =>
      setFormError(applyApiError(err, (field, e) => setError(field as keyof FormValues, e))),
  });

  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const test = useMutation({
    mutationFn: async (to: string) =>
      api("/admin/settings/email/test", { method: "POST", body: { to } }),
    onSuccess: (_, to) =>
      setTestResult({ ok: true, message: `Sent. Check the inbox (and spam folder) of ${to}.` }),
    onError: (err) => setTestResult({ ok: false, message: errorMessage(err) }),
  });

  useEffect(() => {
    if (user && !testTo) setTestTo(user.email);
  }, [user, testTo]);

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} />;
  const s = query.data;
  const err = (k: keyof FormValues) => formState.errors[k]?.message;

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    setTestResult(null);
    if (v.provider === "none") return save.mutate({ provider: "none" });
    if (v.provider === "resend") {
      return save.mutate({
        provider: "resend",
        from: v.from,
        ...(v.apiKey.trim() ? { apiKey: v.apiKey.trim() } : {}),
      });
    }
    const port = Number.parseInt(v.port, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      return setError("port", { message: "Enter a port such as 465 or 587" });
    save.mutate({
      provider: "smtp",
      from: v.from,
      host: v.host,
      port,
      secure: v.secure,
      user: v.user,
      ...(v.password ? { password: v.password } : {}),
    });
  });

  const status = s.configured ? (
    <Badge tone="success">On</Badge>
  ) : (
    <Badge tone="warning">Off: no emails are sent</Badge>
  );

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <PageHeader
          title="Email"
          back={{ href: "/settings", label: "Store settings" }}
          description="Order confirmations, shipping updates, password resets and staff invitations. Until email is set up here, the store works normally but sends no email."
          actions={
            <Button type="submit" loading={save.isPending} disabled={!formState.isDirty}>
              Save
            </Button>
          }
        />
        {formError && (
          <p role="alert" className="bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
            {formError}
          </p>
        )}

        <Section title="How emails are sent" actions={status}>
          {s.source === "environment" && (
            <p className="bg-surface rounded-lg px-3 py-2 text-sm">
              Email is currently sent with the RESEND_API_KEY set on the server. Saving settings
              here replaces it.
            </p>
          )}
          <Field label="Send emails with" htmlFor="e-provider">
            <Select id="e-provider" className="max-w-sm" {...register("provider")}>
              <option value="none">Don&apos;t send emails</option>
              <option value="smtp">SMTP (Gmail, Outlook, Zoho, your host…)</option>
              <option value="resend">Resend</option>
            </Select>
          </Field>

          {provider !== "none" && (
            <Field
              label="From"
              htmlFor="e-from"
              error={err("from")}
              hint={
                provider === "smtp"
                  ? 'Usually the same address you sign in with, e.g. "Urban Store <orders@yourdomain.com>".'
                  : "An address on a domain you verified in Resend."
              }
            >
              <Input id="e-from" invalid={!!err("from")} {...register("from")} />
            </Field>
          )}
        </Section>

        {provider === "smtp" && (
          <Section
            title="SMTP server"
            description="Gmail: turn on 2-Step Verification, create an App password (Google Account → Security → App passwords) and use it below instead of your normal password."
          >
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setValue("host", p.host, { shouldDirty: true });
                    setValue("port", String(p.port), { shouldDirty: true });
                    setValue("secure", p.secure, { shouldDirty: true });
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Server" htmlFor="e-host" error={err("host")}>
                <Input
                  id="e-host"
                  placeholder="smtp.gmail.com"
                  invalid={!!err("host")}
                  {...register("host")}
                />
              </Field>
              <Field label="Port" htmlFor="e-port" error={err("port")}>
                <Input
                  id="e-port"
                  inputMode="numeric"
                  invalid={!!err("port")}
                  {...register("port")}
                />
              </Field>
            </div>
            <Switch
              label="Use SSL/TLS from the start"
              hint="On for port 465. Off for 587, which upgrades the connection with STARTTLS."
              {...register("secure")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Username" htmlFor="e-user" error={err("user")}>
                <Input
                  id="e-user"
                  autoComplete="off"
                  placeholder="orders@yourdomain.com"
                  {...register("user")}
                />
              </Field>
              <Field
                label="Password"
                htmlFor="e-password"
                error={err("password")}
                hint={
                  s.smtp.hasPassword
                    ? "Saved. Leave empty to keep it."
                    : "Stored encrypted and never shown again."
                }
              >
                <Input
                  id="e-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={s.smtp.hasPassword ? "••••••••" : ""}
                  invalid={!!err("password")}
                  {...register("password")}
                />
              </Field>
            </div>
          </Section>
        )}

        {provider === "resend" && (
          <Section title="Resend" description="Create an API key at resend.com → API Keys.">
            <Field
              label="API key"
              htmlFor="e-key"
              error={err("apiKey")}
              hint={
                s.hasResendKey
                  ? "Saved. Leave empty to keep it."
                  : "Stored encrypted and never shown again."
              }
            >
              <Input
                id="e-key"
                type="password"
                autoComplete="off"
                placeholder={s.hasResendKey ? "re_••••••••" : "re_…"}
                invalid={!!err("apiKey")}
                {...register("apiKey")}
              />
            </Field>
          </Section>
        )}
      </form>

      <Section
        title="Send a test email"
        description="Uses the saved settings. Save your changes first."
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setTestResult(null);
            test.mutate(testTo);
          }}
        >
          <Field label="Send to" htmlFor="e-test" className="min-w-64 flex-1">
            <Input
              id="e-test"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            variant="outline"
            loading={test.isPending}
            disabled={!s.configured || formState.isDirty || !testTo}
          >
            Send test email
          </Button>
        </form>
        {testResult && (
          <p
            role="status"
            className={
              testResult.ok
                ? "bg-success/10 text-success rounded-lg px-3 py-2 text-sm"
                : "bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm"
            }
          >
            {testResult.message}
          </p>
        )}
      </Section>
    </div>
  );
}
