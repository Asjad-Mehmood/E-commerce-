"use client";

import type { AdminProductListItemDTO, ApiResponse, PaginatedResponse } from "@hoodie/types";
import { Button } from "@hoodie/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Checkbox, Select } from "@/components/ui/controls";
import { FilterTabs, SearchBox } from "@/components/ui/filters";
import { ErrorState, PageHeader } from "@/components/ui/page";
import { ProductStatusBadge } from "@/components/ui/status";
import { LoadingRows, Pagination, Table, TableMessage, Td, Th, Tr } from "@/components/ui/table";
import { useUrlState } from "@/hooks/use-url-state";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { TaxonomyItem } from "./types";

type Bulk = "publish" | "unpublish" | "archive";
const BULK_LABEL: Record<Bulk, string> = {
  publish: "Publish",
  unpublish: "Move to drafts",
  archive: "Archive",
};

export function useCategories() {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => (await api<ApiResponse<TaxonomyItem[]>>("/admin/categories")).data,
  });
}

export function ProductsList() {
  const qc = useQueryClient();
  const { values, set, query } = useUrlState<"q" | "status" | "category" | "lowStock" | "sort">();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Bulk | null>(null);
  const categories = useCategories();

  const products = useQuery({
    queryKey: ["admin", "products", query],
    queryFn: () =>
      api<PaginatedResponse<AdminProductListItemDTO>>(`/admin/products?limit=25&${query}`),
    placeholderData: keepPreviousData,
  });
  const rows = products.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const bulk = useMutation({
    mutationFn: (action: Bulk) =>
      api<ApiResponse<{ updated: number }>>("/admin/products/bulk", {
        method: "POST",
        body: { ids: [...selected], action },
      }),
    onSuccess: (res, action) => {
      toast.success(`${BULK_LABEL[action]}: ${res.data.updated} product(s)`);
      setSelected(new Set());
      setConfirm(null);
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        description="Archived products are hidden from the store but kept for past orders."
        actions={
          <Link
            href="/products/new"
            className="bg-ink hover:bg-ink/85 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
          >
            Add product
          </Link>
        }
      />
      <FilterTabs
        label="Product status"
        value={values.status ?? ""}
        onChange={(status) => {
          setSelected(new Set());
          set({ status });
        }}
        options={[
          { value: "", label: "All" },
          { value: "ACTIVE", label: "Active" },
          { value: "DRAFT", label: "Drafts" },
          { value: "ARCHIVED", label: "Archived" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={values.q ?? ""}
          onSearch={(q) => set({ q })}
          placeholder="Title or SKU"
          label="Search products"
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
          aria-label="Sort products"
          className="w-auto"
          value={values.sort ?? "updated"}
          onChange={(e) => set({ sort: e.target.value === "updated" ? "" : e.target.value })}
        >
          <option value="updated">Recently updated</option>
          <option value="newest">Newest</option>
          <option value="title">Title A–Z</option>
          <option value="best_selling">Best selling</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </Select>
        <Checkbox
          label="Low stock only"
          checked={values.lowStock === "true"}
          onChange={(e) => set({ lowStock: e.target.checked ? "true" : "" })}
        />
      </div>

      {selected.size > 0 && (
        <div className="bg-ink flex flex-wrap items-center gap-2 rounded-lg px-4 py-2 text-sm text-white">
          <span className="mr-2 font-medium">{selected.size} selected</span>
          {(Object.keys(BULK_LABEL) as Bulk[]).map((a) => (
            <Button
              key={a}
              size="sm"
              variant="outline"
              className="bg-transparent text-white hover:bg-white/10"
              onClick={() => (a === "archive" ? setConfirm(a) : bulk.mutate(a))}
              disabled={bulk.isPending}
            >
              {BULK_LABEL[a]}
            </Button>
          ))}
          <button
            type="button"
            className="ml-auto underline"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {products.isError && <ErrorState message={errorMessage(products.error)} />}
      <Table className={products.isPlaceholderData ? "opacity-60" : undefined}>
        <thead>
          <tr>
            <Th className="w-10">
              <input
                type="checkbox"
                aria-label="Select all on this page"
                className="accent-ink size-4"
                checked={allSelected}
                onChange={() =>
                  setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
                }
              />
            </Th>
            <Th>Product</Th>
            <Th>Status</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-right">Variants</Th>
            <Th className="text-right">Stock</Th>
            <Th className="text-right">Sold</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {products.isPending ? (
            <LoadingRows cols={8} />
          ) : rows.length === 0 ? (
            <TableMessage cols={8}>No products found.</TableMessage>
          ) : (
            rows.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.title}`}
                    className="accent-ink size-4"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                </Td>
                <Td>
                  <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- thumbnails from any image host
                      <img
                        src={p.image}
                        alt=""
                        className="bg-surface size-10 rounded-md object-cover"
                      />
                    ) : (
                      <span className="bg-surface size-10 rounded-md" />
                    )}
                    <span className="font-medium hover:underline">{p.title}</span>
                  </Link>
                </Td>
                <Td>
                  <ProductStatusBadge status={p.status} />
                </Td>
                <Td className="text-right tabular-nums">{formatMoney(p.basePrice)}</Td>
                <Td className="text-right tabular-nums">{p.variantCount}</Td>
                <Td
                  className={`text-right tabular-nums ${p.totalStock === 0 ? "text-danger font-medium" : ""}`}
                >
                  {p.totalStock}
                </Td>
                <Td className="text-right tabular-nums">{p.soldCount}</Td>
                <Td className="text-muted">{formatDate(p.updatedAt)}</Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
      <Pagination meta={products.data?.meta} onPage={(page) => set({ page })} label="products" />

      <ConfirmDialog
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        title={`Archive ${selected.size} product(s)?`}
        tone="danger"
        confirmLabel="Archive"
        loading={bulk.isPending}
        onConfirm={() => bulk.mutate("archive")}
      >
        Archived products disappear from the store. Past orders keep them, and you can publish them
        again from the Archived tab.
      </ConfirmDialog>
    </div>
  );
}
