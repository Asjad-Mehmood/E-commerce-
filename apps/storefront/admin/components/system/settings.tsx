"use client";

import type { ApiResponse, StoreSettingsDTO, StoreSettingsResponseDTO } from "@hoodie/types";
import { Badge, Button, Field, Input, Skeleton } from "@hoodie/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "@/admin/lib/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AffixInput, Switch, Textarea } from "@/admin/components/ui/controls";
import { DetailList, ErrorState, PageHeader, Section } from "@/admin/components/ui/page";
import { api, errorMessage } from "@/admin/lib/api";
import { applyApiError } from "@/admin/lib/forms";

/** react-hook-form treats dots as nesting, so keys are stored with underscores. */
const FIELD = (key: keyof StoreSettingsDTO) => key.replace(/\./g, "_");

export function Settings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => (await api<ApiResponse<StoreSettingsResponseDTO>>("/admin/settings")).data,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } =
    useForm<Record<string, string | boolean>>();

  const toForm = (s: StoreSettingsDTO) =>
    Object.fromEntries(
      Object.entries(s).map(([k, v]) => [
        k.replace(/\./g, "_"),
        typeof v === "number" ? String(v) : v,
      ]),
    );

  useEffect(() => {
    if (query.data) reset(toForm(query.data.settings));
  }, [query.data, reset]);

  const save = useMutation({
    mutationFn: async (body: Partial<StoreSettingsDTO>) =>
      (
        await api<ApiResponse<StoreSettingsResponseDTO>>("/admin/settings", {
          method: "PATCH",
          body,
        })
      ).data,
    onSuccess: (data) => {
      qc.setQueryData(["admin", "settings"], data);
      reset(toForm(data.settings));
      toast.success("Settings saved");
    },
    onError: (err) =>
      setFormError(
        applyApiError(err, (field, e) => setError(String(field).replace(/\./g, "_"), e)),
      ),
  });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} />;
  const { system } = query.data;
  const err = (key: keyof StoreSettingsDTO) =>
    formState.errors[key.replace(/\./g, "_")]?.message as string | undefined;

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const get = (k: keyof StoreSettingsDTO) => v[k.replace(/\./g, "_")];
    const rate = Number(get("tax.rate"));
    const windowDays = Number.parseInt(String(get("returns.windowDays")), 10);
    if (Number.isNaN(rate)) return setError("tax_rate", { message: "Enter a number" });
    if (Number.isNaN(windowDays))
      return setError("returns_windowDays", { message: "Enter a number of days" });
    save.mutate({
      "store.name": String(get("store.name")),
      "store.email": String(get("store.email")),
      "store.phone": String(get("store.phone")),
      "store.address": String(get("store.address")),
      "tax.rate": rate,
      "tax.inclusive": Boolean(get("tax.inclusive")),
      "payments.card.enabled": Boolean(get("payments.card.enabled")),
      "payments.cod.enabled": Boolean(get("payments.cod.enabled")),
      "returns.windowDays": windowDays,
      "reviews.autoApprove": Boolean(get("reviews.autoApprove")),
      "notifications.dailyDigest": Boolean(get("notifications.dailyDigest")),
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <PageHeader
        title="Store settings"
        description="Business details and checkout options. Changes apply to new orders straight away."
        actions={
          <Button type="submit" loading={save.isPending} disabled={!formState.isDirty}>
            Save settings
          </Button>
        }
      />
      {formError && (
        <p role="alert" className="bg-danger/10 text-danger rounded-lg px-4 py-3 text-sm">
          {formError}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Store details"
            description="Shown on invoices, packing slips and email replies."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Store name" htmlFor="s-name" error={err("store.name")}>
                <Input id="s-name" {...register(FIELD("store.name"))} />
              </Field>
              <Field label="Support email" htmlFor="s-email" error={err("store.email")}>
                <Input id="s-email" type="email" {...register(FIELD("store.email"))} />
              </Field>
              <Field label="Phone" htmlFor="s-phone" error={err("store.phone")}>
                <Input id="s-phone" {...register(FIELD("store.phone"))} />
              </Field>
            </div>
            <Field label="Address" htmlFor="s-address" error={err("store.address")}>
              <Textarea id="s-address" className="min-h-16" {...register(FIELD("store.address"))} />
            </Field>
          </Section>

          <Section
            title="Payments"
            description="Which payment methods checkout offers. At least one must stay on."
          >
            <Switch
              label="Card payments"
              disabled={!system.paymentProvider}
              hint={
                system.paymentProvider === "stripe"
                  ? "Processed by Stripe."
                  : system.paymentProvider === "demo"
                    ? "Demo mode: only Stripe test cards work and no real money moves. Add Stripe keys to the API to take real payments."
                    : "Off: cards need Stripe keys on the server (STRIPE_SECRET_KEY). Customers pay Cash on Delivery."
              }
              {...register(FIELD("payments.card.enabled"))}
            />
            <Switch
              label="Cash on Delivery"
              hint="Fees and availability per city are set under Shipping."
              {...register(FIELD("payments.cod.enabled"))}
            />
            {err("payments.cod.enabled") && (
              <p role="alert" className="text-danger text-sm">
                {err("payments.cod.enabled")}
              </p>
            )}
          </Section>

          <Section title="Tax">
            <Field
              label="Tax rate"
              htmlFor="s-tax"
              error={err("tax.rate")}
              hint="0 if you don't charge sales tax."
            >
              <AffixInput
                id="s-tax"
                suffix="%"
                inputMode="decimal"
                className="max-w-40"
                {...register(FIELD("tax.rate"))}
              />
            </Field>
            <Switch
              label="Prices include tax"
              hint="On: product prices already include tax, which is shown on invoices. Off: tax is added at checkout."
              {...register(FIELD("tax.inclusive"))}
            />
          </Section>

          <Section
            title="Email"
            description={
              system.emailProvider
                ? "Order confirmations, shipping updates and password resets are being sent."
                : "Email isn't set up, so the store sends no emails. Orders still work: customers see their order details on screen."
            }
            actions={
              <Link href="/settings/email" className="text-sm font-medium underline">
                {system.emailProvider ? "Email settings" : "Set up email"}
              </Link>
            }
          />

          <Section title="Reviews and emails">
            <Switch
              label="Publish reviews straight away"
              hint="Off: new and edited reviews wait in Reviews until staff publish them. Only customers who received the product can review it."
              {...register(FIELD("reviews.autoApprove"))}
            />
            <Switch
              label="Daily summary email"
              hint="At 08:00, managers and Super Admins get yesterday's sales and what needs attention. Needs Redis for the job scheduler."
              {...register(FIELD("notifications.dailyDigest"))}
            />
          </Section>

          <Section title="Returns">
            <Field
              label="Return window"
              htmlFor="s-returns"
              error={err("returns.windowDays")}
              hint="Days after delivery a customer can ask for a return from their order page. 0 turns returns off."
            >
              <AffixInput
                id="s-returns"
                suffix="days"
                inputMode="numeric"
                className="max-w-40"
                {...register(FIELD("returns.windowDays"))}
              />
            </Field>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="System" description="Set by the server's configuration.">
            <DetailList
              items={[
                ["Currency", system.currency],
                ["Time zone", system.timeZone],
                [
                  "Card payments",
                  system.paymentProvider === "stripe" ? (
                    <Badge key="p" tone="success">
                      Stripe
                    </Badge>
                  ) : system.paymentProvider === "demo" ? (
                    <Badge key="p" tone="warning">
                      Demo mode
                    </Badge>
                  ) : (
                    <Badge key="p" tone="danger">
                      Not configured
                    </Badge>
                  ),
                ],
                [
                  "Email",
                  system.emailProvider ? (
                    <Badge key="e" tone="success">
                      {system.emailProvider === "smtp" ? "SMTP" : "Resend"}
                    </Badge>
                  ) : (
                    <Badge key="e" tone="warning">
                      Off: no emails sent
                    </Badge>
                  ),
                ],
                [
                  "Image uploads",
                  system.uploads === "cloudinary" ? (
                    <Badge key="u" tone="success">
                      Cloudinary
                    </Badge>
                  ) : (
                    <Badge key="u" tone="neutral">
                      Database
                    </Badge>
                  ),
                ],
              ]}
            />
          </Section>
          <Section title="More settings">
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/settings/shipping" className="underline">
                  Shipping zones and Cash on Delivery fees
                </Link>
              </li>
              <li>
                <Link href="/content" className="underline">
                  Announcement bar, banners and pages
                </Link>
              </li>
              <li>
                <Link href="/settings/email" className="underline">
                  Email (SMTP or Resend)
                </Link>
              </li>
              <li>
                <Link href="/staff" className="underline">
                  Staff accounts
                </Link>
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </form>
  );
}
