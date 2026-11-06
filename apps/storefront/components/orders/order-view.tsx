"use client";

import type { ApiResponse, OrderDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { Button, Card, Container, Skeleton } from "@hoodie/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { siteConfig } from "@/lib/config";
import { OrderProgress, OrderTimeline, StatusBadge } from "./order-progress";

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? "border-line flex justify-between border-t pt-3 text-base font-semibold"
          : "flex justify-between"
      }
    >
      <dt className={strong ? undefined : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function OrderView({ number }: { number: string }) {
  const params = useSearchParams();
  const token = params.get("token");
  const justPlaced = params.get("placed") === "1";
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const qc = useQueryClient();

  const order = useQuery({
    queryKey: ["order", number, token],
    queryFn: async () => (await api<ApiResponse<OrderDTO>>(`/orders/${number}${qs}`)).data,
    // Card payments are confirmed by a webhook a moment later: poll briefly.
    refetchInterval: (q) =>
      justPlaced && q.state.data?.status === "PENDING_PAYMENT" ? 2000 : false,
  });

  const cancel = useMutation({
    mutationFn: () =>
      api<ApiResponse<OrderDTO>>(`/orders/${number}/cancel${qs}`, { method: "POST" }),
    onSuccess: ({ data }) => {
      qc.setQueryData(["order", number, token], data);
      toast.success("Your order was cancelled");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not cancel the order"),
  });

  if (order.isLoading) {
    return (
      <Container className="py-12">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-8 h-72" />
      </Container>
    );
  }
  if (!order.data) {
    return (
      <Container className="py-24 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <p className="text-muted mt-2">
          Open the link from your confirmation email, or sign in to see your orders.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm font-medium">
          <Link href="/track-order" className="underline">
            Track an order
          </Link>
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </div>
      </Container>
    );
  }

  const o = order.data;
  const a = o.shippingAddress;
  const placedDate = new Date(o.placedAt).toLocaleDateString("en-PK", { dateStyle: "long" });

  return (
    <Container className="max-w-5xl py-10 sm:py-14">
      {justPlaced && o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED" && (
        <div role="status" className="bg-success/10 mb-8 rounded-2xl p-6">
          <p className="text-success text-sm font-semibold">Thank you!</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Your order is confirmed</h1>
          <p className="text-muted mt-2 text-sm">
            We’ve emailed a confirmation to <strong className="text-ink">{o.email}</strong>.
            {o.paymentMethod === "COD" && (
              <>
                {" "}
                Please keep <strong className="text-ink">{formatMoney(o.grandTotal)}</strong> ready
                in cash.
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Order {o.number}</h2>
          <p className="text-muted text-sm">Placed {placedDate}</p>
        </div>
        <StatusBadge status={o.status} />
      </div>

      {o.canPay && (
        <Card className="border-warning/40 bg-warning/10 mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {justPlaced
              ? "Confirming your payment…"
              : "This order is waiting for payment. Your items are reserved for a short time."}
          </p>
          {!justPlaced && (
            <Link
              href={`/checkout/pay?order=${o.number}${token ? `&token=${encodeURIComponent(token)}` : ""}`}
              className="bg-ink inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
            >
              Pay now
            </Link>
          )}
        </Card>
      )}

      <div className="mt-8">
        <OrderProgress status={o.status} />
        {o.trackingNumber && (
          <p className="mt-4 text-sm">
            {o.courier ?? "Courier"} tracking number:{" "}
            <strong className="font-mono">{o.trackingNumber}</strong>
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section aria-labelledby="items-heading">
            <h3 id="items-heading" className="mb-4 font-semibold">
              Items
            </h3>
            <ul className="divide-line border-line divide-y border-y">
              {o.items.map((i) => (
                <li key={i.sku} className="flex gap-4 py-4">
                  <div className="bg-surface relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg">
                    {i.imageUrl && (
                      <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1 text-sm">
                    <Link href={`/products/${i.slug}`} className="font-medium hover:underline">
                      {i.title}
                    </Link>
                    <p className="text-muted">
                      {i.color} · {i.size} · Qty {i.quantity}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">{formatMoney(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="history-heading">
            <h3 id="history-heading" className="mb-4 font-semibold">
              History
            </h3>
            <OrderTimeline events={o.timeline} />
          </section>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-semibold">Summary</h3>
            <dl className="space-y-1.5 text-sm">
              <Line label="Subtotal" value={formatMoney(o.subtotal)} />
              {o.discountTotal > 0 && (
                <Line
                  label={`Discount (${o.couponCode})`}
                  value={`−${formatMoney(o.discountTotal)}`}
                />
              )}
              <Line
                label={o.shippingMethod}
                value={o.shippingTotal ? formatMoney(o.shippingTotal) : "Free"}
              />
              {o.codFee > 0 && <Line label="Cash on Delivery fee" value={formatMoney(o.codFee)} />}
              {o.taxTotal > 0 && <Line label="Tax" value={formatMoney(o.taxTotal)} />}
              <Line label="Total" value={formatMoney(o.grandTotal)} strong />
            </dl>
            <p className="text-muted mt-3 text-xs">
              Payment: {o.paymentMethod === "COD" ? "Cash on Delivery" : "Card"}
            </p>
          </Card>
          <Card>
            <h3 className="mb-2 font-semibold">Delivery address</h3>
            <address className="text-muted text-sm not-italic">
              {a.fullName}
              <br />
              {a.line1}
              {a.line2 && <>, {a.line2}</>}
              <br />
              {a.city} {a.postalCode}
              <br />
              {a.phone}
            </address>
            {o.customerNote && <p className="text-muted mt-3 text-sm">Note: {o.customerNote}</p>}
          </Card>
          <div className="flex flex-col gap-2">
            <a
              href={`${siteConfig.apiUrl}/orders/${o.number}/invoice${qs}`}
              className="border-line hover:bg-surface flex h-10 items-center justify-center rounded-lg border text-sm font-medium"
            >
              Download invoice (PDF)
            </a>
            {o.canCancel && (
              <Button
                variant="ghost"
                className="text-danger"
                loading={cancel.isPending}
                onClick={() =>
                  confirm("Cancel this order? Items will be released.") && cancel.mutate()
                }
              >
                Cancel order
              </Button>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
