"use client";

import type {
  ApiResponse,
  CategoryReportRowDTO,
  InventoryValuationRowDTO,
  ProductReportRowDTO,
  SalesReportDTO,
} from "@hoodie/types";
import { Button, Input } from "@hoodie/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/controls";
import { FilterTabs } from "@/components/ui/filters";
import { ErrorState, PageHeader, Section } from "@/components/ui/page";
import { ProductStatusBadge } from "@/components/ui/status";
import { LoadingRows, Table, TableMessage, Td, Th, Tr } from "@/components/ui/table";
import { useUrlState } from "@/hooks/use-url-state";
import { api, downloadFile, errorMessage } from "@/lib/api";
import { formatMoney, shiftDay, storeToday } from "@/lib/format";

const PRESETS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "custom", label: "Custom" },
];

function useReport<T>(path: string, query: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "report", path, query],
    queryFn: async () => (await api<ApiResponse<T>>(`/admin/reports/${path}?${query}`)).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

function CsvButton({ path, query }: { path: string; query: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadFile(`/admin/reports/${path}?${query}&format=csv`);
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      Download CSV
    </Button>
  );
}

const periodLabel = (period: string, groupBy: string) => {
  const d = new Date(`${period}T00:00:00Z`);
  if (groupBy === "month")
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return groupBy === "week" ? `Week of ${day}` : day;
};

export function Reports() {
  const { values, set } = useUrlState<"range" | "from" | "to" | "groupBy" | "tab">();
  const range = values.range ?? "30";
  const today = storeToday();
  const from =
    range === "custom"
      ? (values.from ?? shiftDay(today, -29))
      : shiftDay(today, -(Number(range) - 1));
  const to = range === "custom" ? (values.to ?? today) : today;
  const groupBy = values.groupBy ?? (Number(range) > 90 ? "month" : "day");
  const q = new URLSearchParams({ from, to, groupBy }).toString();
  const tab = values.tab ?? "";

  const sales = useReport<SalesReportDTO>("sales", q, tab === "");
  const products = useReport<ProductReportRowDTO[]>("products", q, tab === "products");
  const categories = useReport<CategoryReportRowDTO[]>("categories", q, tab === "categories");
  const inventory = useReport<InventoryValuationRowDTO[]>("inventory", "", tab === "inventory");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Sales are counted by order date in Pakistan time, from paid and confirmed orders. Net = order totals minus refunds."
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          label="Date range"
          options={PRESETS}
          value={range}
          onChange={(r) => set({ range: r, from: "", to: "" })}
        />
        {range === "custom" && (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <Input
              type="date"
              aria-label="From"
              className="w-auto"
              value={from}
              max={to}
              onChange={(e) => set({ from: e.target.value, range: "custom" })}
            />
            to
            <Input
              type="date"
              aria-label="To"
              className="w-auto"
              value={to}
              min={from}
              max={today}
              onChange={(e) => set({ to: e.target.value, range: "custom" })}
            />
          </span>
        )}
      </div>

      <FilterTabs
        label="Report"
        value={tab}
        onChange={(t) => set({ tab: t })}
        options={[
          { value: "", label: "Sales" },
          { value: "products", label: "Products" },
          { value: "categories", label: "Categories" },
          { value: "inventory", label: "Inventory value" },
        ]}
      />

      {tab === "" && (
        <Section
          title="Sales"
          description={`${from} to ${to}`}
          actions={
            <span className="flex gap-2">
              <Select
                aria-label="Group by"
                className="h-8 w-auto"
                value={groupBy}
                onChange={(e) => set({ groupBy: e.target.value })}
              >
                <option value="day">By day</option>
                <option value="week">By week</option>
                <option value="month">By month</option>
              </Select>
              <CsvButton path="sales" query={q} />
            </span>
          }
        >
          {sales.isError && <ErrorState message={errorMessage(sales.error)} />}
          {sales.data && (
            <div className="grid gap-4 sm:grid-cols-4">
              {(
                [
                  ["Net sales", formatMoney(sales.data.totals.net)],
                  ["Orders", sales.data.totals.orders.toLocaleString()],
                  ["Units sold", sales.data.totals.units.toLocaleString()],
                  ["Refunds", formatMoney(sales.data.totals.refunds)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="bg-surface rounded-lg p-3">
                  <p className="text-muted text-sm">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
          )}
          <Table className={sales.isPlaceholderData ? "opacity-60" : undefined}>
            <thead>
              <tr>
                <Th>Period</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Units</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">Discounts</Th>
                <Th className="text-right">Shipping &amp; fees</Th>
                <Th className="text-right">Refunds</Th>
                <Th className="text-right">Net</Th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {!sales.data ? (
                <LoadingRows cols={8} />
              ) : (
                [...sales.data.rows].reverse().map((r) => (
                  <Tr key={r.period} className={r.orders === 0 ? "text-muted" : undefined}>
                    <Td>{periodLabel(r.period, sales.data!.groupBy)}</Td>
                    <Td className="text-right">{r.orders}</Td>
                    <Td className="text-right">{r.units}</Td>
                    <Td className="text-right">{formatMoney(r.gross)}</Td>
                    <Td className="text-right">
                      {r.discounts ? `−${formatMoney(r.discounts)}` : "—"}
                    </Td>
                    <Td className="text-right">{formatMoney(r.shipping)}</Td>
                    <Td className="text-right">{r.refunds ? `−${formatMoney(r.refunds)}` : "—"}</Td>
                    <Td className="text-right font-medium">{formatMoney(r.net)}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </Section>
      )}

      {tab === "products" && (
        <Section
          title="Best sellers"
          description="Revenue is item totals before order discounts. Fully refunded orders are left out."
          actions={<CsvButton path="products" query={q} />}
        >
          <Table>
            <thead>
              <tr>
                <Th className="w-10">#</Th>
                <Th>Product</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Units</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {!products.data ? (
                <LoadingRows cols={5} />
              ) : products.data.length === 0 ? (
                <TableMessage cols={5}>No sales in this period.</TableMessage>
              ) : (
                products.data.map((p, i) => (
                  <Tr key={p.productId}>
                    <Td className="text-muted">{i + 1}</Td>
                    <Td className="font-medium">{p.title}</Td>
                    <Td className="text-right">{p.orders}</Td>
                    <Td className="text-right">{p.units}</Td>
                    <Td className="text-right">{formatMoney(p.revenue)}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </Section>
      )}

      {tab === "categories" && (
        <Section
          title="Sales by category"
          description="A product in two categories counts in both."
          actions={<CsvButton path="categories" query={q} />}
        >
          <Table>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th className="text-right">Units</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {!categories.data ? (
                <LoadingRows cols={3} />
              ) : categories.data.length === 0 ? (
                <TableMessage cols={3}>No sales in this period.</TableMessage>
              ) : (
                categories.data.map((c) => (
                  <Tr key={c.categoryId ?? "none"}>
                    <Td className="font-medium">{c.name}</Td>
                    <Td className="text-right">{c.units}</Td>
                    <Td className="text-right">{formatMoney(c.revenue)}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </Section>
      )}

      {tab === "inventory" && (
        <Section
          title="Inventory value"
          description="Units in stock right now, valued at their selling price (cost prices aren't recorded yet). Not affected by the date range."
          actions={<CsvButton path="inventory" query="" />}
        >
          {inventory.data && (
            <p className="text-sm">
              <span className="font-semibold">
                {inventory.data.reduce((n, r) => n + r.units, 0).toLocaleString()}
              </span>{" "}
              units worth{" "}
              <span className="font-semibold">
                {formatMoney(inventory.data.reduce((n, r) => n + r.retailValue, 0))}
              </span>{" "}
              at retail prices.
            </p>
          )}
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Status</Th>
                <Th className="text-right">Units</Th>
                <Th className="text-right">Retail value</Th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {!inventory.data ? (
                <LoadingRows cols={4} />
              ) : (
                inventory.data.map((r) => (
                  <Tr key={r.productId}>
                    <Td className="font-medium">{r.title}</Td>
                    <Td>
                      <ProductStatusBadge status={r.status} />
                    </Td>
                    <Td className="text-right">{r.units}</Td>
                    <Td className="text-right">{formatMoney(r.retailValue)}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </Section>
      )}
    </div>
  );
}
