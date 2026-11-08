import { Container } from "@hoodie/ui";
import type { Metadata } from "next";
import { TrackOrder } from "@/components/orders/track-order";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your order with your order number and email.",
};

export default function TrackOrderPage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight">Track your order</h1>
      <p className="text-muted mt-2">Enter the order number from your confirmation email.</p>
      <div className="mt-8">
        <TrackOrder />
      </div>
    </Container>
  );
}
