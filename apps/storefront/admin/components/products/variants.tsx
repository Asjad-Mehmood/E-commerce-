"use client";

import type { AdminVariantDTO, ApiResponse } from "@hoodie/types";
import { compareSizes, SIZES } from "@hoodie/types";
import { Badge, Button, cn, Field, Input } from "@hoodie/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StockDialog, type StockTarget } from "@/admin/components/inventory/stock-dialog";
import { ConfirmDialog } from "@/admin/components/ui/confirm";
import { AffixInput } from "@/admin/components/ui/controls";
import { Section } from "@/admin/components/ui/page";
import { StockBadge } from "@/admin/components/ui/status";
import { Table, Td, Th, Tr } from "@/admin/components/ui/table";
import { api, ApiError, errorMessage } from "@/admin/lib/api";
import { fromMinor, toMinor } from "@/admin/lib/forms";
import { skuPrefixFor } from "@/admin/lib/sku";
import { formatMoney } from "@/admin/lib/format";
import type { AdminProduct } from "./types";

function Generator({ product, onDone }: { product: AdminProduct; onDone: () => void }) {
  const existingColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of product.variants)
      if (!map.has(v.color)) map.set(v.color, v.colorHex ?? "#111111");
    return [...map].map(([name, hex]) => ({ name, hex }));
  }, [product.variants]);

  const [sizes, setSizes] = useState<string[]>(["S", "M", "L", "XL"]);
  const [colors, setColors] = useState(
    existingColors.length ? existingColors : [{ name: "Black", hex: "#111111" }],
  );
  const [prefix, setPrefix] = useState(skuPrefixFor(product.title, product.id));
  const [initialStock, setInitialStock] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () =>
      (
        await api<ApiResponse<{ created: number; skipped: number }>>(
          `/admin/products/${product.id}/variants/generate`,
          {
            method: "POST",
            body: {
              sizes,
              colors: colors
                .filter((c) => c.name.trim())
                .map((c) => ({ name: c.name.trim(), hex: c.hex })),
              skuPrefix: prefix,
              initialStock: Number.parseInt(initialStock, 10) || 0,
            },
          },
        )
      ).data,
    onSuccess: (r) => {
      toast.success(
        r.created
          ? `Created ${r.created} variant(s)${r.skipped ? `, ${r.skipped} already existed` : ""}`
          : "All of these combinations already exist",
      );
      onDone();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message)
          : errorMessage(err),
      ),
  });

  const count = sizes.length * colors.filter((c) => c.name.trim()).length;

  return (
    <div className="bg-surface space-y-4 rounded-lg p-4">
      <div>
        <h3 className="font-semibold">Size × colour generator</h3>
        <p className="text-muted text-sm">
          Creates every missing combination. Safe to run again after adding a colour: existing
          variants are left alone.
        </p>
      </div>
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <fieldset>
        <legend className="text-sm font-medium">Sizes</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIZES.map((s) => {
            const on = sizes.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSizes((all) =>
                    on ? all.filter((x) => x !== s) : [...all, s].sort(compareSizes),
                  )
                }
                className={cn(
                  "h-9 min-w-12 rounded-lg border px-3 text-sm font-medium",
                  on ? "bg-ink border-ink text-white" : "border-line bg-canvas hover:border-ink",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">Colours</legend>
        <ul className="mt-2 space-y-2">
          {colors.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Colour ${i + 1} swatch`}
                value={c.hex}
                onChange={(e) =>
                  setColors((all) =>
                    all.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)),
                  )
                }
                className="border-line h-9 w-11 cursor-pointer rounded-lg border p-1"
              />
              <Input
                aria-label={`Colour ${i + 1} name`}
                value={c.name}
                onChange={(e) =>
                  setColors((all) =>
                    all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
                placeholder="Colour name, e.g. Heather Grey"
                className="h-9 max-w-64"
              />
              {colors.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${c.name || "colour"}`}
                  onClick={() => setColors((all) => all.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setColors((all) => [...all, { name: "", hex: "#888888" }])}
        >
          + Add colour
        </Button>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="SKU prefix"
          htmlFor="sku-prefix"
          hint={`SKUs look like ${prefix || "PRE"}-BLA-M`}
        >
          <Input
            id="sku-prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            maxLength={20}
          />
        </Field>
        <Field label="Starting stock per variant" htmlFor="initial-stock">
          <Input
            id="initial-stock"
            type="number"
            min={0}
            value={initialStock}
            onChange={(e) => setInitialStock(e.target.value)}
          />
        </Field>
      </div>
      <Button
        onClick={() => {
          setError(null);
          generate.mutate();
        }}
        loading={generate.isPending}
        disabled={count === 0 || !prefix}
      >
        Generate {count} variant{count === 1 ? "" : "s"}
      </Button>
    </div>
  );
}

function VariantRow({
  v,
  basePrice,
  onSaved,
  onAdjust,
  onDelete,
}: {
  v: AdminVariantDTO;
  basePrice: number;
  onSaved: () => void;
  onAdjust: () => void;
  onDelete: () => void;
}) {
  const [sku, setSku] = useState(v.sku);
  const [price, setPrice] = useState(fromMinor(v.price));
  const [lowAt, setLowAt] = useState(String(v.lowStockAt));
  const dirty = sku !== v.sku || price !== fromMinor(v.price) || lowAt !== String(v.lowStockAt);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/admin/variants/${v.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success(`Saved ${v.color} / ${v.size}`);
      onSaved();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submit = () => {
    const minor = toMinor(price);
    if (minor !== null && (Number.isNaN(minor) || minor <= 0))
      return toast.error("Enter a price above zero, or leave it empty to use the product price");
    const low = Number.parseInt(lowAt, 10);
    if (Number.isNaN(low) || low < 0) return toast.error("Enter a low-stock level of 0 or more");
    save.mutate({ sku: sku.trim(), price: minor, lowStockAt: low });
  };

  return (
    <Tr className={cn(!v.isActive && "opacity-60")}>
      <Td>
        <span className="flex items-center gap-2">
          <span
            className="border-line size-4 shrink-0 rounded-full border"
            style={{ background: v.colorHex ?? "transparent" }}
            aria-hidden
          />
          <span className="font-medium">{v.color}</span>
          <span className="text-muted">/ {v.size}</span>
        </span>
      </Td>
      <Td>
        <Input
          aria-label={`SKU for ${v.color} ${v.size}`}
          value={sku}
          onChange={(e) => setSku(e.target.value.toUpperCase())}
          className="h-8 w-40 font-mono text-xs"
        />
      </Td>
      <Td>
        <AffixInput
          prefix="Rs"
          aria-label={`Price for ${v.color} ${v.size}`}
          inputMode="decimal"
          value={price}
          placeholder={fromMinor(basePrice)}
          onChange={(e) => setPrice(e.target.value)}
          className="h-8 w-32"
        />
      </Td>
      <Td>
        <span className="flex items-center gap-2">
          <StockBadge available={v.available} lowStockAt={v.lowStockAt} />
          {v.reserved > 0 && <span className="text-muted text-xs">({v.reserved} held)</span>}
          <Button size="sm" variant="ghost" onClick={onAdjust}>
            Adjust
          </Button>
        </span>
      </Td>
      <Td>
        <Input
          aria-label={`Low-stock alert for ${v.color} ${v.size}`}
          type="number"
          min={0}
          value={lowAt}
          onChange={(e) => setLowAt(e.target.value)}
          className="h-8 w-20"
        />
      </Td>
      <Td>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-ink size-4"
            checked={v.isActive}
            disabled={save.isPending}
            onChange={(e) => save.mutate({ isActive: e.target.checked })}
          />
          {v.isActive ? "On sale" : "Hidden"}
        </label>
      </Td>
      <Td className="whitespace-nowrap text-right">
        {dirty && (
          <Button size="sm" onClick={submit} loading={save.isPending}>
            Save
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          aria-label={`Delete ${v.color} ${v.size}`}
        >
          Delete
        </Button>
      </Td>
    </Tr>
  );
}

export function VariantsSection({ product }: { product: AdminProduct }) {
  const qc = useQueryClient();
  const [showGenerator, setShowGenerator] = useState(product.variants.length === 0);
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);
  const [toDelete, setToDelete] = useState<AdminVariantDTO | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin", "product", product.id] });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/variants/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Variant deleted");
      setToDelete(null);
      refresh();
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setToDelete(null);
    },
  });

  const variants = [...product.variants].sort(
    (a, b) => a.color.localeCompare(b.color) || compareSizes(a.size, b.size),
  );
  const totalStock = variants.reduce((n, v) => n + v.stock, 0);

  return (
    <Section
      title="Variants"
      description={
        variants.length
          ? `${variants.length} variants · ${totalStock} in stock. Leave a variant's price empty to use the product price (${formatMoney(product.basePrice)}).`
          : "Each size and colour combination is a variant with its own SKU and stock."
      }
      actions={
        variants.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowGenerator((s) => !s)}>
            {showGenerator ? "Hide generator" : "Add sizes or colours"}
          </Button>
        )
      }
    >
      {showGenerator && (
        <Generator
          product={product}
          onDone={() => {
            refresh();
            setShowGenerator(false);
          }}
        />
      )}
      {variants.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Variant</Th>
              <Th>SKU</Th>
              <Th>Price</Th>
              <Th>Available</Th>
              <Th>Low-stock alert</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <VariantRow
                key={`${v.id}-${v.sku}-${v.price}-${v.lowStockAt}`}
                v={v}
                basePrice={product.basePrice}
                onSaved={refresh}
                onAdjust={() =>
                  setStockTarget({
                    variantId: v.id,
                    label: `${v.color} / ${v.size}`,
                    stock: v.stock,
                    reserved: v.reserved,
                  })
                }
                onDelete={() => setToDelete(v)}
              />
            ))}
          </tbody>
        </Table>
      )}
      {variants.some((v) => !v.isActive) && (
        <p className="text-muted text-sm">
          <Badge>Hidden</Badge> variants can&apos;t be bought but keep their stock and history.
        </p>
      )}

      <StockDialog target={stockTarget} onClose={() => setStockTarget(null)} onSaved={refresh} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.color} / ${toDelete?.size}?`}
        tone="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      >
        Only variants that were never ordered can be deleted. To stop selling one that was, untick
        &quot;On sale&quot; instead.
      </ConfirmDialog>
    </Section>
  );
}
