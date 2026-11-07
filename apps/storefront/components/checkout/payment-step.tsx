"use client";

import type { ApiResponse, OrderDTO, PaymentSessionDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { Card, Container, Skeleton } from "@hoodie/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cartKey } from "@/hooks/use-cart";
import { api } from "@/lib/api";
import { siteConfig } from "@/lib/config";
import { DemoCardForm } from "./demo-card-form";
import { StripeCardForm } from "./stripe-card-form";

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="font-mono tabular-nums">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function PaymentStep() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const number = params.get("order") ?? "";
  const token = params.get("token") ?? "";
  const qs = `token=${encodeURIComponent(token)}`;
  const orderUrl = `/orders/${number}?${qs}`;

  const order = useQuery({
    queryKey: ["order", number, token],
    queryFn: async () => (await api<ApiResponse<OrderDTO>>(`/orders/${number}?${qs}`)).data,
    enabled: !!number,
  });
  const session = useQuery({
    queryKey: ["payment", number, token],
    queryFn: async () =>
      (await api<ApiResponse<PaymentSessionDTO>>(`/orders/${number}/payment?${qs}`)).data,
    enabled: !!order.data?.canPay,
    staleTime: Infinity,
  });

  // Already paid, cancelled or expired: show the order instead.
  useEffect(() => {
    if (order.data && !order.data.canPay) router.replace(orderUrl);
  }, [order.data, orderUrl, router]);

  const onPaid = () => {
    void qc.invalidateQueries({ queryKey: cartKey });
    router.push(`${orderUrl}&placed=1`);
  };

  if (order.isError) {
    return (
      <Container className="py-20 text-center">
        <p>We couldn’t find this order.</p>
        <Link href="/cart" className="mt-4 inline-block underline">
          Back to cart
        </Link>
      </Container>
    );
  }

  const o = order.data;
  const s = session.data;
  return (
    <Container className="grid max-w-4xl gap-10 py-10 sm:py-14 md:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment</h1>
        {o?.payBy && (
          <p className="text-muted mt-2 text-sm">
            Your items are reserved for <Countdown until={o.payBy} />. Complete payment to confirm
            order <strong>{o.number}</strong>.
          </p>
        )}
        <div className="mt-8">
          {!o || !s ? (
            <Skeleton className="h-72" />
          ) : s.provider === "demo" ? (
            <DemoCardForm clientSecret={s.clientSecret} amount={s.amount} onPaid={onPaid} />
          ) : s.publishableKey ? (
            <StripeCardForm
              publishableKey={s.publishableKey}
              clientSecret={s.clientSecret}
              amount={s.amount}
              returnUrl={`${siteConfig.url}${orderUrl}&placed=1`}
              onPaid={onPaid}
            />
          ) : (
            <p className="text-danger">Card payments are not configured. Please contact us.</p>
          )}
        </div>
        <p className="text-muted mt-6 text-sm">
          Changed your mind?{" "}
          <Link href={orderUrl} className="underline">
            View or cancel this order
          </Link>
          .
        </p>
      </div>

      <Card className="h-fit space-y-3 text-sm">
        <h2 className="font-semibold">Order {o?.number}</h2>
        {o ? (
          <>
            <ul className="space-y-1">
              {o.items.map((i) => (
                <li key={i.sku} className="flex justify-between gap-2">
                  <span className="text-muted">
                    {i.title} ({i.size}) × {i.quantity}
                  </span>
                  <span className="tabular-nums">{formatMoney(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="border-line flex justify-between border-t pt-3 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(o.grandTotal)}</span>
            </div>
          </>
        ) : (
          <Skeleton className="h-24" />
        )}
      </Card>
    </Container>
  );
}
