"use client";

import type { OrderListItemDTO, PaginatedResponse } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { Skeleton } from "@hoodie/ui";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useMe } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { StatusBadge } from "./order-progress";

export function useMyOrders(limit = 20) {
  const me = useMe();
  return useQuery({
    queryKey: ["my-orders", limit],
    queryFn: () => api<PaginatedResponse<OrderListItemDTO>>(`/me/orders?limit=${limit}`),
    enabled: !!me.data,
  });
}

export function OrderList({ orders }: { orders: OrderListItemDTO[] }) {
  return (
    <ul className="divide-line border-line divide-y border-y">
      {orders.map((o) => (
        <li key={o.number}>
          <Link
            href={`/orders/${o.number}`}
            className="hover:bg-surface flex items-center gap-4 py-4 sm:px-2"
          >
            <div className="bg-surface relative aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg">
              {o.imageUrl && (
                <Image src={o.imageUrl} alt="" fill sizes="48px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{o.number}</p>
              <p className="text-muted text-sm">
                {new Date(o.placedAt).toLocaleDateString("en-PK", { dateStyle: "medium" })} ·{" "}
                {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{formatMoney(o.grandTotal)}</p>
              <div className="mt-1">
                <StatusBadge status={o.status} />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MyOrders() {
  const { data, isLoading } = useMyOrders();
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">Orders</h2>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data?.data.length ? (
        <p className="text-muted">
          You haven’t placed any orders yet.{" "}
          <Link href="/shop" className="text-ink underline">
            Start shopping
          </Link>
          .
        </p>
      ) : (
        <OrderList orders={data.data} />
      )}
    </div>
  );
}
