"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { AddressDTO, ApiResponse, CheckoutResultDTO, QuoteDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { checkoutSchema } from "@hoodie/validation";
import { Badge, Button, Card, cn, Container, Field, Input, Skeleton } from "@hoodie/ui";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { useMe } from "@/hooks/use-auth";
import { useAddresses } from "@/hooks/use-addresses";
import { cartKey, useCart } from "@/hooks/use-cart";
import { api, ApiError } from "@/lib/api";
import { applyApiError } from "@/lib/forms";
import { FormMessage } from "../auth/auth-card";
import { OrderSummary } from "./order-summary";

const formSchema = checkoutSchema.omit({ idempotencyKey: true });
type FormInput = z.input<typeof formSchema>;

function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const toAddress = (a: AddressDTO) => ({
  fullName: a.fullName,
  phone: a.phone,
  line1: a.line1,
  line2: a.line2 ?? undefined,
  city: a.city,
  state: a.state ?? undefined,
  postalCode: a.postalCode,
  country: a.country,
});

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`step-${step}`} className="border-line border-b pb-8">
      <h2 id={`step-${step}`} className="mb-5 flex items-center gap-3 text-lg font-semibold">
        <span className="bg-ink grid size-7 place-items-center rounded-full text-sm text-white">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CheckoutForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const { data: cart, isLoading: cartLoading } = useCart();
  const { data: addresses } = useAddresses();
  const idempotencyKey = useRef<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAddressId, setSavedAddressId] = useState<string | "new" | null>(null);
  const placing = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      phone: "",
      shippingAddress: {
        fullName: "",
        phone: "",
        line1: "",
        city: "",
        postalCode: "",
        country: "PK",
      },
      shippingMethod: "standard",
      paymentMethod: "STRIPE",
      saveAddress: false,
    },
  });

  // Prefill from the signed-in customer and their default address, once.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !me.isFetched) return;
    if (me.data && addresses === undefined) return; // wait for addresses
    prefilled.current = true;
    const def = addresses?.find((a) => a.isDefault) ?? addresses?.[0];
    reset((v) => ({
      ...v,
      email: me.data?.email ?? v.email,
      phone: me.data?.phone ?? def?.phone ?? v.phone,
      shippingAddress: def ? toAddress(def) : v.shippingAddress,
    }));
    setSavedAddressId(def ? def.id : "new");
  }, [me.isFetched, me.data, addresses, reset]);

  const [city, shippingMethod, paymentMethod] = useWatch({
    control,
    name: ["shippingAddress.city", "shippingMethod", "paymentMethod"],
  });
  const debouncedCity = useDebounced(city ?? "");

  const quote = useQuery({
    queryKey: [
      "quote",
      debouncedCity,
      shippingMethod,
      paymentMethod,
      cart?.total,
      cart?.itemCount,
      cart?.coupon?.code,
    ],
    queryFn: async () =>
      (
        await api<ApiResponse<QuoteDTO>>("/checkout/quote", {
          method: "POST",
          body: { city: debouncedCity, shippingMethod, paymentMethod },
        })
      ).data,
    enabled: !!cart && cart.items.length > 0,
    placeholderData: keepPreviousData,
  });

  // Fall back when the shopper's choice is unavailable (e.g. no express delivery to
  // this city). Only fresh quotes count: while a new quote loads, the previous one
  // is still shown and would otherwise undo the choice the shopper just made.
  useEffect(() => {
    const q = quote.data;
    if (!q || quote.isPlaceholderData) return;
    if (!q.shippingOptions.some((o) => o.id === shippingMethod))
      setValue("shippingMethod", q.shippingMethod);
    if (!q.paymentOptions.some((p) => p.method === paymentMethod && p.available))
      setValue("paymentMethod", q.paymentMethod);
  }, [quote.data, quote.isPlaceholderData, shippingMethod, paymentMethod, setValue]);

  useEffect(() => {
    if (!cartLoading && cart && cart.items.length === 0 && !placing.current)
      router.replace("/cart");
  }, [cart, cartLoading, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // One key per attempt: a double click or network retry returns the same order.
    idempotencyKey.current ??= crypto.randomUUID();
    placing.current = true;
    try {
      const { data } = await api<ApiResponse<CheckoutResultDTO>>("/checkout", {
        method: "POST",
        body: { ...values, idempotencyKey: idempotencyKey.current },
      });
      const q = `token=${encodeURIComponent(data.accessToken)}`;
      void qc.invalidateQueries({ queryKey: cartKey });
      void qc.invalidateQueries({ queryKey: ["addresses"] });
      router.push(
        data.payment
          ? `/checkout/pay?order=${data.orderNumber}&${q}`
          : `/orders/${data.orderNumber}?${q}&placed=1`,
      );
    } catch (err) {
      placing.current = false;
      idempotencyKey.current = null; // nothing was created: the next attempt is a new checkout
      if (err instanceof ApiError && (err.code === "OUT_OF_STOCK" || err.code === "CONFLICT")) {
        void qc.invalidateQueries({ queryKey: cartKey });
        setFormError(`${err.message}. Please review your cart.`);
      } else {
        setFormError(applyApiError(err, setError) ?? "Please check the highlighted fields.");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  if (cartLoading || !cart || !me.isFetched) {
    return (
      <Container className="py-12">
        <Skeleton className="h-9 w-48" />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-72" />
        </div>
      </Container>
    );
  }

  type AddressField = "fullName" | "phone" | "line1" | "city" | "postalCode";
  const addressError = (k: AddressField) => errors.shippingAddress?.[k]?.message;
  const q = quote.data;

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
      {!me.data && (
        <p className="text-muted mt-2 text-sm">
          Have an account?{" "}
          <Link href="/login?next=/checkout" className="text-ink underline">
            Sign in
          </Link>{" "}
          for faster checkout.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_400px]"
      >
        <div className="space-y-8">
          {formError && <FormMessage>{formError}</FormMessage>}

          <Section step={1} title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Email"
                htmlFor="email"
                error={errors.email?.message}
                hint="For your order confirmation."
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  readOnly={!!me.data}
                  invalid={!!errors.email}
                  {...register("email")}
                />
              </Field>
              <Field
                label="Phone"
                htmlFor="phone"
                error={errors.phone?.message}
                hint="The courier will call this number."
              >
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  invalid={!!errors.phone}
                  {...register("phone")}
                />
              </Field>
            </div>
          </Section>

          <Section step={2} title="Delivery address">
            {addresses && addresses.length > 0 && (
              <fieldset className="mb-5 space-y-2">
                <legend className="sr-only">Choose an address</legend>
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
                      savedAddressId === a.id ? "border-ink" : "border-line",
                    )}
                  >
                    <input
                      type="radio"
                      name="saved-address"
                      className="accent-ink mt-1"
                      checked={savedAddressId === a.id}
                      onChange={() => {
                        setSavedAddressId(a.id);
                        setValue("shippingAddress", toAddress(a), { shouldValidate: true });
                      }}
                    />
                    <span>
                      <strong>{a.fullName}</strong> · {a.line1}, {a.city} {a.postalCode}
                    </span>
                  </label>
                ))}
                <label
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
                    savedAddressId === "new" ? "border-ink" : "border-line",
                  )}
                >
                  <input
                    type="radio"
                    name="saved-address"
                    className="accent-ink"
                    checked={savedAddressId === "new"}
                    onChange={() => {
                      setSavedAddressId("new");
                      setValue("shippingAddress", {
                        fullName: me.data?.name ?? "",
                        phone: "",
                        line1: "",
                        city: "",
                        postalCode: "",
                        country: "PK",
                      });
                    }}
                  />
                  Use a different address
                </label>
              </fieldset>
            )}

            <div
              className={cn(
                "grid gap-4 sm:grid-cols-2",
                addresses?.length && savedAddressId !== "new" && "hidden",
              )}
            >
              <Field label="Full name" htmlFor="ship-name" error={addressError("fullName")}>
                <Input
                  id="ship-name"
                  autoComplete="shipping name"
                  invalid={!!addressError("fullName")}
                  {...register("shippingAddress.fullName")}
                />
              </Field>
              <Field label="Phone for delivery" htmlFor="ship-phone" error={addressError("phone")}>
                <Input
                  id="ship-phone"
                  type="tel"
                  autoComplete="shipping tel"
                  invalid={!!addressError("phone")}
                  {...register("shippingAddress.phone")}
                />
              </Field>
              <Field
                label="Address"
                htmlFor="ship-line1"
                error={addressError("line1")}
                className="sm:col-span-2"
              >
                <Input
                  id="ship-line1"
                  autoComplete="shipping address-line1"
                  placeholder="House, street, area"
                  invalid={!!addressError("line1")}
                  {...register("shippingAddress.line1")}
                />
              </Field>
              <Field
                label="Apartment, landmark (optional)"
                htmlFor="ship-line2"
                className="sm:col-span-2"
              >
                <Input
                  id="ship-line2"
                  autoComplete="shipping address-line2"
                  {...register("shippingAddress.line2", {
                    setValueAs: (v: string) => v || undefined,
                  })}
                />
              </Field>
              <Field label="City" htmlFor="ship-city" error={addressError("city")}>
                <Input
                  id="ship-city"
                  autoComplete="shipping address-level2"
                  invalid={!!addressError("city")}
                  {...register("shippingAddress.city")}
                />
              </Field>
              <Field label="Postal code" htmlFor="ship-postal" error={addressError("postalCode")}>
                <Input
                  id="ship-postal"
                  autoComplete="shipping postal-code"
                  invalid={!!addressError("postalCode")}
                  {...register("shippingAddress.postalCode")}
                />
              </Field>
              {me.data && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    className="accent-ink size-4"
                    {...register("saveAddress")}
                  />
                  Save this address to my account
                </label>
              )}
            </div>
          </Section>

          <Section step={3} title="Delivery method">
            {!q ? (
              <Skeleton className="h-20" />
            ) : (
              <fieldset className="space-y-2">
                <legend className="text-muted mb-2 text-sm">Delivering to {q.zone}</legend>
                {q.shippingOptions.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4",
                      shippingMethod === o.id ? "border-ink" : "border-line",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        value={o.id}
                        className="accent-ink"
                        {...register("shippingMethod")}
                      />
                      <span>
                        <span className="block font-medium">{o.label}</span>
                        <span className="text-muted text-sm">
                          {o.estimatedDays === "1"
                            ? "Next working day"
                            : `${o.estimatedDays} working days`}
                        </span>
                      </span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {o.price === 0 ? "Free" : formatMoney(o.price)}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
          </Section>

          <Section step={4} title="Payment">
            {!q ? (
              <Skeleton className="h-20" />
            ) : (
              <fieldset className="space-y-2">
                <legend className="sr-only">Payment method</legend>
                {q.paymentOptions
                  .filter((p) => p.available)
                  .map((p) => (
                    <label
                      key={p.method}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4",
                        paymentMethod === p.method ? "border-ink" : "border-line",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          value={p.method}
                          className="accent-ink"
                          {...register("paymentMethod")}
                        />
                        <span>
                          <span className="flex items-center gap-2 font-medium">
                            {p.label}
                            {p.demo && <Badge tone="warning">Demo mode</Badge>}
                          </span>
                          <span className="text-muted text-sm">
                            {p.method === "COD"
                              ? "Pay in cash when your order arrives."
                              : p.demo
                                ? "Test cards only. No real money is taken."
                                : "Visa, Mastercard. Secured by Stripe."}
                          </span>
                        </span>
                      </span>
                      {p.fee > 0 && (
                        <span className="text-sm tabular-nums">+{formatMoney(p.fee)}</span>
                      )}
                    </label>
                  ))}
              </fieldset>
            )}
            <Field label="Order note (optional)" htmlFor="note" className="mt-5">
              <textarea
                id="note"
                rows={2}
                maxLength={500}
                placeholder="e.g. Please call before delivery"
                className="border-line focus:border-ink focus:ring-ink/10 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                {...register("customerNote", { setValueAs: (v: string) => v || undefined })}
              />
            </Field>
          </Section>
        </div>

        <Card className="space-y-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">Order summary</h2>
          <OrderSummary
            cart={cart}
            quote={q}
            loading={quote.isFetching}
            onCouponChange={() => void quote.refetch()}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isSubmitting}
            disabled={!q || cart.warnings.length > 0}
          >
            {paymentMethod === "COD" ? "Place order" : "Continue to payment"}
          </Button>
          {cart.warnings.length > 0 && (
            <p className="text-danger text-sm">
              Some items need attention.{" "}
              <Link href="/cart" className="underline">
                Review your cart
              </Link>
              .
            </p>
          )}
          <p className="text-muted text-center text-xs">
            By placing your order you agree to our{" "}
            <Link href="/policies/terms" className="underline">
              terms
            </Link>
            .
          </p>
        </Card>
      </form>
    </Container>
  );
}
