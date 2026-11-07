"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ApiResponse, OrderTrackingDTO } from "@hoodie/types";
import { trackOrderSchema } from "@hoodie/validation";
import { Button, Card, Field, Input } from "@hoodie/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiError } from "@/lib/api";
import { FormMessage } from "../auth/auth-card";
import { OrderProgress, OrderTimeline, StatusBadge } from "./order-progress";

export function TrackOrder() {
  const [result, setResult] = useState<OrderTrackingDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(trackOrderSchema) });

  return (
    <div className="space-y-8">
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          setResult(null);
          try {
            const qs = new URLSearchParams(values).toString();
            setResult((await api<ApiResponse<OrderTrackingDTO>>(`/orders/track?${qs}`)).data);
          } catch (err) {
            setError(
              err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
            );
          }
        })}
      >
        <Field label="Order number" htmlFor="track-number" error={errors.number?.message}>
          <Input
            id="track-number"
            placeholder="HD-10001"
            invalid={!!errors.number}
            {...register("number")}
          />
        </Field>
        <Field label="Email used for the order" htmlFor="track-email" error={errors.email?.message}>
          <Input
            id="track-email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
        <Button type="submit" loading={isSubmitting} className="h-10">
          Track
        </Button>
      </form>

      {error && <FormMessage>{error}</FormMessage>}

      {result && (
        <Card className="space-y-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Order {result.number}</h2>
              <p className="text-muted text-sm">
                {result.shippingMethod} to {result.city}
              </p>
            </div>
            <StatusBadge status={result.status} />
          </div>
          <OrderProgress status={result.status} />
          {result.trackingNumber && (
            <p className="text-sm">
              {result.courier ?? "Courier"} tracking number:{" "}
              <strong className="font-mono">{result.trackingNumber}</strong>
            </p>
          )}
          <ul className="text-muted text-sm">
            {result.items.map((i, n) => (
              <li key={n}>
                {i.title} ({i.color}, {i.size}) × {i.quantity}
              </li>
            ))}
          </ul>
          <OrderTimeline events={result.timeline} />
        </Card>
      )}
    </div>
  );
}
