"use client";

import type { AdminOrderListItemDTO, PaginatedResponse } from "@hoodie/types";
import { Button, Input } from "@hoodie/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/controls";
import { FilterTabs, SearchBox } from "@/components/ui/filters";
import { ErrorState, PageHeader } from "@/components/ui/page";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status";
import { LoadingRows, Pagination, Table, TableMessage, Td, Th, Tr } from "@/components/ui/table";
import { useUrlState } from "@/hooks/use-url-state";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "CONFIRMED,PAID,PROCESSING", label: "To fulfil" },
  { value: "PENDING_PAYMENT", label: "Awaiting payment" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

type Key = "q" | "status" | "paymentMethod" | "from" | "to" | "sort";

export function OrdersList() {
  const router = useRouter();
  const { values, set, query, page } = useUrlState<Key>();
  const [exporting, setExporting] = useState(false);
  const status = STATUS_TABS.some((t) => t.value === (values.status ?? ""))
    ? (values.status ?? "")
    : "";

  const orders = useQuery({
    queryKey: ["admin", "orders", query],
    queryFn: () => api<PaginatedResponse<AdminOrderListItemDTO>>(`/admin/orders?limit=25&${query}`),
    placeholderData: keepPreviousData,
  });
  const filtered = !!(
    values.q ||
    values.status ||
    values.paymentMethod ||
    values.from ||
    values.to
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams(query);
      params.delete("page");
      await downloadFile(`/admin/orders/export?${params}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description="Every order, newest first. Click an order to fulfil, cancel or refund it."
        actions={
          <Button variant="outline" onClick={exportCsv} loading={exporting}>
            Export CSV
          </Button>
        }
      />

      <FilterTabs
        label="Order status"
        options={STATUS_TABS}
        value={status}
        onChange={(v) => set({ status: v })}
      />

      <div className="flex flex-wrap items-end gap-3">
        <SearchBox
          value={values.q ?? ""}
          onSearch={(q) => set({ q })}
          placeholder="Order number, email, phone or name"
          label="Search orders"
          className="w-full sm:w-72"
        />
        <Select
          aria-label="Payment method"
          className="w-auto"
          value={values.paymentMethod ?? ""}
          onChange={(e) => set({ paymentMethod: e.target.value })}
        >
          <option value="">All payment methods</option>
          <option value="STRIPE">Card</option>
          <option value="COD">Cash on Delivery</option>
        </Select>
        <label className="text-muted flex items-center gap-2 text-sm">
          From
          <Input
            type="date"
            className="w-auto"
            value={values.from ?? ""}
            max={values.to}
            onChange={(e) => set({ from: e.target.value })}
          />
        </label>
        <label className="text-muted flex items-center gap-2 text-sm">
          To
          <Input
            type="date"
            className="w-auto"
            value={values.to ?? ""}
            min={values.from}
            onChange={(e) => set({ to: e.target.value })}
          />
        </label>
        <Select
          aria-label="Sort orders"
          className="w-auto"
          value={values.sort ?? "newest"}
          onChange={(e) => set({ sort: e.target.value === "newest" ? "" : e.target.value })}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total_desc">Highest total</option>
          <option value="total_asc">Lowest total</option>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() =>
              set({ q: "", status: "", paymentMethod: "", from: "", to: "", sort: "" })
            }
          >
            Clear filters
          </Button>
        )}
      </div>

      {orders.isError && (
        <ErrorState message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} />
      )}

      <Table className={orders.isPlaceholderData ? "opacity-60" : undefined}>
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Placed</Th>
            <Th>Customer</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
            <Th className="text-right">Items</Th>
            <Th className="text-right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {orders.isPending ? (
            <LoadingRows cols={7} />
          ) : orders.data?.data.length === 0 ? (
            <TableMessage cols={7}>
              {filtered ? "No orders match these filters." : "No orders yet."}
            </TableMessage>
          ) : (
            orders.data?.data.map((o) => (
              <Tr
                key={o.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("a")) router.push(`/orders/${o.number}`);
                }}
              >
                <Td className="font-medium">
                  <Link href={`/orders/${o.number}`} className="hover:underline">
                    {o.number}
                  </Link>
                </Td>
                <Td className="text-muted whitespace-nowrap">{formatDateTime(o.placedAt)}</Td>
                <Td>
                  <span className="block font-medium">{o.customerName}</span>
                  <span className="text-muted">{o.city}</span>
                </Td>
                <Td>
                  <span className="mr-2">{o.paymentMethod === "COD" ? "COD" : "Card"}</span>
                  {o.status === "CANCELLED" && o.paymentStatus === "FAILED" ? (
                    <span className="text-muted text-xs">Not paid</span>
                  ) : (
                    <PaymentStatusBadge status={o.paymentStatus} />
                  )}
                </Td>
                <Td>
                  <OrderStatusBadge status={o.status} />
                </Td>
                <Td className="text-right tabular-nums">{o.itemCount}</Td>
                <Td className="text-right tabular-nums">
                  {formatMoney(o.grandTotal)}
                  {o.refundedTotal > 0 && (
                    <span className="text-danger block text-xs">
                      −{formatMoney(o.refundedTotal)} refunded
                    </span>
                  )}
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>

      <Pagination meta={orders.data?.meta} onPage={(p) => set({ page: p })} label="orders" />
      {page > 1 && orders.data?.data.length === 0 && (
        <Button variant="outline" onClick={() => set({ page: 1 })}>
          Back to the first page
        </Button>
      )}
    </div>
  );
}
