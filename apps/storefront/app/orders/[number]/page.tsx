import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderView } from "@/components/orders/order-view";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return (
    <Suspense>
      <OrderView number={decodeURIComponent(number).toUpperCase()} />
    </Suspense>
  );
}
