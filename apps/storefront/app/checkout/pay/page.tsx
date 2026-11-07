import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentStep } from "@/components/checkout/payment-step";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default function PayPage() {
  return (
    <Suspense>
      <PaymentStep />
    </Suspense>
  );
}
