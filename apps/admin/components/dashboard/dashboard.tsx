"use client";

import type { ApiResponse, DashboardDTO, KpiDTO } from "@hoodie/types";
import { Card, cn, Skeleton } from "@hoodie/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { FilterTabs } from "@/components/ui/filters";
import { ErrorState, PageHeader, Section } from "@/components/ui/page";
import { OrderStatusBadge, StockBadge } from "@/components/ui/status";
import { useCan, useStaff } from "@/hooks/use-session";
import { api, errorMessage } from "@/lib/api";
import { formatMoney, percentChange, timeAgo } from "@/lib/format";
import { SalesChart } from "./sales-chart";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;
type Range = (typeof RANGES)[number]["value"];

function Delta({ kpi, days }: { kpi: KpiDTO; days: string }) {
  const change = percentChange(kpi.value, kpi.previous);
  const vs = `vs previous ${days} days`;
  if (change === null)
    return <p className="text-muted mt-1 text-xs">Nothing in the previous {days} days</p>;
  const up = change > 0;
  const flat = Math.abs(change) < 0.5;
  return (
    <p className="mt-1 text-xs">
      <span
        className={cn("font-semibold", flat ? "text-muted" : up ? "text-success" : "text-danger")}
      >
        {flat ? "No change" : `${up ? "↑" : "↓"} ${Math.abs(change).toFixed(0)}%`}
      </span>{" "}
      <span className="text-muted">{vs}</span>
    </p>
  );
}

function StatTile({
  label,
  value,
  kpi,
  days,
}: {
  label: string;
  value: string;
  kpi: KpiDTO;
  days: string;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-muted text-sm">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
      <Delta kpi={kpi} days={days} />
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export function Dashboard() {
  const user = useStaff();
  const isManager = useCan("MANAGER");
  const [days, setDays] = useState<Range>("30");
  const query = useQuery({
    queryKey: ["admin", "dashboard", days],
    queryFn: async () =>
      (await api<ApiResponse<DashboardDTO>>(`/admin/dashboard?days=${days}`)).data,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const d = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${user.name}. Sales are net of refunds, by order date (Pakistan time).`}
      />
      <FilterTabs label="Date range" options={[...RANGES]} value={days} onChange={setDays} />

      {query.isError && !d && (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      )}
      {!d && query.isPending && <DashboardSkeleton />}

      {d && (
        <div
          className={cn("space-y-6 transition-opacity", query.isPlaceholderData && "opacity-60")}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile
              label="Net sales"
              value={formatMoney(d.kpis.sales.value)}
              kpi={d.kpis.sales}
              days={days}
            />
            <StatTile
              label="Orders"
              value={d.kpis.orders.value.toLocaleString()}
              kpi={d.kpis.orders}
              days={days}
            />
            <StatTile
              label="Average order value"
              value={formatMoney(d.kpis.averageOrderValue.value)}
              kpi={d.kpis.averageOrderValue}
              days={days}
            />
            <StatTile
              label="New customers"
              value={d.kpis.newCustomers.value.toLocaleString()}
              kpi={d.kpis.newCustomers}
              days={days}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/orders?status=CONFIRMED,PAID,PROCESSING"
              className="border-line bg-canvas hover:border-ink rounded-(--radius-card) border p-4"
            >
              <p className="text-muted text-sm">To fulfil</p>
              <p className="mt-1 text-xl font-semibold">
                {d.toFulfil} order{d.toFulfil === 1 ? "" : "s"}
              </p>
              <p className="text-muted mt-1 text-xs">Paid or confirmed, not yet shipped →</p>
            </Link>
            <Link
              href="/orders?status=PENDING_PAYMENT"
              className="border-line bg-canvas hover:border-ink rounded-(--radius-card) border p-4"
            >
              <p className="text-muted text-sm">Awaiting card payment</p>
              <p className="mt-1 text-xl font-semibold">{d.awaitingPayment}</p>
              <p className="text-muted mt-1 text-xs">Released automatically if unpaid →</p>
            </Link>
            <div className="border-line bg-canvas rounded-(--radius-card) border p-4">
              <p className="text-muted text-sm">Today</p>
              <p className="mt-1 text-xl font-semibold">{formatMoney(d.today.sales)}</p>
              <p className="text-muted mt-1 text-xs">
                from {d.today.orders} order{d.today.orders === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <Section title="Net sales per day" description={`${d.range.from} to ${d.range.to}`}>
            <SalesChart data={d.series} dim={query.isPlaceholderData} />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="Top products"
              description="By revenue in this period"
              actions={
                isManager && (
                  <Link href="/reports" className="text-sm font-medium underline">
                    Reports
                  </Link>
                )
              }
            >
              {d.topProducts.length === 0 ? (
                <p className="text-muted text-sm">No sales in this period yet.</p>
              ) : (
                <ol className="divide-line divide-y text-sm">
                  {d.topProducts.map((p, i) => (
                    <li key={p.productId} className="flex items-center gap-3 py-2.5">
                      <span className="text-muted w-4 tabular-nums">{i + 1}</span>
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small thumbnails from any image host
                        <img src={p.image} alt="" className="size-10 rounded-md object-cover" />
                      ) : (
                        <span className="bg-surface size-10 rounded-md" />
                      )}
                      <span className="min-w-0 flex-1">
                        {isManager ? (
                          <Link
                            href={`/products/${p.productId}`}
                            className="block truncate font-medium hover:underline"
                          >
                            {p.title}
                          </Link>
                        ) : (
                          <span className="block truncate font-medium">{p.title}</span>
                        )}
                        <span className="text-muted">{p.units} sold</span>
                      </span>
                      <span className="font-medium tabular-nums">{formatMoney(p.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section
              title="Low stock"
              description="Available units at or below each variant's alert level"
              actions={
                isManager && (
                  <Link href="/inventory?stock=low" className="text-sm font-medium underline">
                    Inventory
                  </Link>
                )
              }
            >
              {d.lowStock.length === 0 ? (
                <p className="text-muted text-sm">Everything is well stocked.</p>
              ) : (
                <ul className="divide-line divide-y text-sm">
                  {d.lowStock.map((v) => (
                    <li
                      key={v.variantId}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{v.productTitle}</span>
                        <span className="text-muted">
                          {v.color} / {v.size} · {v.sku}
                        </span>
                      </span>
                      <StockBadge available={v.available} lowStockAt={v.lowStockAt} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section
              className="lg:col-span-2"
              title="Recent orders"
              actions={
                <Link href="/orders" className="text-sm font-medium underline">
                  All orders
                </Link>
              }
            >
              {d.recentOrders.length === 0 ? (
                <p className="text-muted text-sm">No orders yet.</p>
              ) : (
                <ul className="divide-line divide-y text-sm">
                  {d.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/orders/${o.number}`}
                        className="hover:bg-surface -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5"
                      >
                        <span className="w-24 font-medium">{o.number}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {o.customerName} <span className="text-muted">· {o.city}</span>
                        </span>
                        <OrderStatusBadge status={o.status} />
                        <span className="w-24 text-right tabular-nums">
                          {formatMoney(o.grandTotal)}
                        </span>
                        <span className="text-muted w-20 text-right text-xs">
                          {timeAgo(o.placedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Payment methods" description="Order totals in this period">
              {d.paymentMix.length === 0 ? (
                <p className="text-muted text-sm">No sales in this period yet.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {d.paymentMix.map((m) => {
                    const total = d.paymentMix.reduce((n, x) => n + x.sales, 0);
                    const share = total ? Math.round((m.sales / total) * 100) : 0;
                    return (
                      <li key={m.method}>
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {m.method === "COD" ? "Cash on Delivery" : "Card"}
                          </span>
                          <span className="tabular-nums">{share}%</span>
                        </div>
                        <p className="text-muted">
                          {formatMoney(m.sales)} · {m.orders} order{m.orders === 1 ? "" : "s"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
