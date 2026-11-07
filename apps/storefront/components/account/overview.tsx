"use client";

import { Button, Card } from "@hoodie/ui";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-auth";
import { useAddresses } from "@/hooks/use-addresses";
import { OrderList, useMyOrders } from "../orders/my-orders";
import { api } from "@/lib/api";

export function AccountOverview() {
  const { data: me } = useMe();
  const { data: addresses } = useAddresses();
  const { data: orders } = useMyOrders(3);
  const [sending, setSending] = useState(false);
  if (!me) return null;
  const defaultAddress = addresses?.find((a) => a.isDefault);

  async function resend() {
    setSending(true);
    try {
      await api("/auth/resend-verification", { method: "POST" });
      toast.success(`We sent a new link to ${me!.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-lg">
        Hi <strong>{me.name.split(" ")[0]}</strong>, welcome back.
      </p>

      {!me.emailVerified && (
        <Card className="border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Please verify <strong>{me.email}</strong> so we can send your order updates.
          </p>
          <Button size="sm" variant="outline" onClick={resend} loading={sending}>
            Resend email
          </Button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Profile</h2>
          <p className="text-muted mt-2 text-sm">{me.name}</p>
          <p className="text-muted text-sm">{me.email}</p>
          {me.phone && <p className="text-muted text-sm">{me.phone}</p>}
          <Link href="/account/profile" className="mt-4 inline-block text-sm font-medium underline">
            Edit profile
          </Link>
        </Card>
        <Card>
          <h2 className="font-semibold">Default address</h2>
          {defaultAddress ? (
            <address className="text-muted mt-2 text-sm not-italic">
              {defaultAddress.fullName}
              <br />
              {defaultAddress.line1}
              {defaultAddress.line2 && `, ${defaultAddress.line2}`}
              <br />
              {defaultAddress.city} {defaultAddress.postalCode}
            </address>
          ) : (
            <p className="text-muted mt-2 text-sm">No saved address yet.</p>
          )}
          <Link
            href="/account/addresses"
            className="mt-4 inline-block text-sm font-medium underline"
          >
            Manage addresses
          </Link>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Recent orders</h2>
        {orders?.data.length ? (
          <>
            <div className="mt-2">
              <OrderList orders={orders.data} />
            </div>
            <Link
              href="/account/orders"
              className="mt-4 inline-block text-sm font-medium underline"
            >
              All orders
            </Link>
          </>
        ) : (
          <>
            <p className="text-muted mt-2 text-sm">You haven’t placed any orders yet.</p>
            <Link href="/shop" className="mt-4 inline-block text-sm font-medium underline">
              Start shopping
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
