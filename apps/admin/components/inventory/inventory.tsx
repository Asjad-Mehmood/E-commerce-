"use client";

import type { InventoryRowDTO, PaginatedResponse } from "@hoodie/types";
import { Badge, Button } from "@hoodie/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useCategories } from "@/components/products/products-list";
import { Select } from "@/components/ui/controls";
import { FilterTabs, SearchBox } from "@/components/ui/filters";
import { ErrorState, PageHeader } from "@/components/ui/page";
import { StockBadge } from "@/components/ui/status";
import { LoadingRows, Pagination, Table, TableMessage, Td, Th, Tr } from "@/components/ui/table";
import { useUrlState } from "@/hooks/use-url-state";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { StockDialog, type StockTarget } from "./stock-dialog";

export function Inventory() {
  const { values, set, query } = useUrlState<"q" | "stock" | "category" | "sort">();
  const categories = useCategories();
  const [target, setTarget] = useState<StockTarget | null>(null);
  const rows = useQuery({
    queryKey: ["admin", "inventory", query],
    queryFn: () => api<PaginatedResponse<InventoryRowDTO>>(`/admin/inventory?${query}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description="Stock for every size and colour. Every change is recorded with a reason. Units held by orders awaiting card payment can't be sold to anyone else."
      />
      <FilterTabs
        label="Stock level"
        value={values.stock ?? ""}
        onChange={(stock) => set({ stock })}
        options={[
          { value: "", label: "All" },
          { value: "low", label: "Low stock" },
          { value: "out", label: "Out of stock" },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={values.q ?? ""}
          onSearch={(q) => set({ q })}
          placeholder="Product, SKU or colour"
          label="Search inventory"
          className="w-full sm:w-64"
        />
        <Select
          aria-label="Category"
          className="w-auto"
          value={values.category ?? ""}
          onChange={(e) => set({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort"
          className="w-auto"
          value={values.sort ?? "stock_asc"}
          onChange={(e) => set({ sort: e.target.value === "stock_asc" ? "" : e.target.value })}
        >
          <option value="stock_asc">Lowest stock first</option>
          <option value="stock_desc">Highest stock first</option>
          <option value="product">Product A–Z</option>
          <option value="sku">SKU</option>
        </Select>
      </div>

      {rows.isError && <ErrorState message={errorMessage(rows.error)} />}
      <Table className={rows.isPlaceholderData ? "opacity-60" : undefined}>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Variant</Th>
            <Th>SKU</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-right">In stock</Th>
            <Th className="text-right">Held</Th>
            <Th>Available</Th>
            <Th className="text-right">Alert at</Th>
            <Th className="text-right" title="Shoppers waiting for a back-in-stock email">
              Waiting
            </Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.isPending ? (
            <LoadingRows cols={10} />
          ) : rows.data?.data.length === 0 ? (
            <TableMessage cols={10}>Nothing matches these filters.</TableMessage>
          ) : (
            rows.data?.data.map((r) => (
              <Tr key={r.variantId} className={r.isActive ? undefined : "opacity-60"}>
                <Td>
                  <Link href={`/products/${r.productId}`} className="flex items-center gap-3">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- thumbnails from any image host
                      <img
                        src={r.image}
                        alt=""
                        className="bg-surface size-9 rounded-md object-cover"
                      />
                    ) : (
                      <span className="bg-surface size-9 rounded-md" />
                    )}
                    <span className="font-medium hover:underline">{r.productTitle}</span>
                  </Link>
                </Td>
                <Td>
                  <span className="flex items-center gap-2">
                    <span
                      className="border-line size-3.5 rounded-full border"
                      style={{ background: r.colorHex ?? "transparent" }}
                      aria-hidden
                    />
                    {r.color} / {r.size}
                    {!r.isActive && <Badge>Hidden</Badge>}
                    {r.productStatus === "DRAFT" && <Badge tone="warning">Draft</Badge>}
                  </span>
                </Td>
                <Td className="font-mono text-xs">{r.sku}</Td>
                <Td className="text-right tabular-nums">{formatMoney(r.price)}</Td>
                <Td className="text-right tabular-nums">{r.stock}</Td>
                <Td className="text-muted text-right tabular-nums">{r.reserved || "—"}</Td>
                <Td>
                  <StockBadge available={r.available} lowStockAt={r.lowStockAt} />
                </Td>
                <Td className="text-muted text-right tabular-nums">{r.lowStockAt}</Td>
                <Td className="text-right tabular-nums">
                  {r.waiting ? (
                    <span title="Emailed automatically when you add stock">{r.waiting}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setTarget({
                        variantId: r.variantId,
                        label: `${r.productTitle}, ${r.color} / ${r.size}`,
                        stock: r.stock,
                        reserved: r.reserved,
                      })
                    }
                  >
                    Adjust
                  </Button>
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
      <Pagination meta={rows.data?.meta} onPage={(page) => set({ page })} label="variants" />
      <StockDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
