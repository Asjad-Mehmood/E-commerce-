"use client";

import type { ProductSort } from "@hoodie/types";
import { PRODUCT_SORTS } from "@hoodie/types";
import { defaultSort, SORT_LABELS } from "@/lib/listing";
import { FIT_LABEL } from "@/lib/size-guide";
import { useListingNav } from "./listing-nav";

export function SortSelect({ value, search = false }: { value: ProductSort; search?: boolean }) {
  const { update } = useListingNav();
  const fallback = defaultSort(search ? "q" : undefined);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted hidden sm:inline">Sort by</span>
      <select
        value={value}
        onChange={(e) => update({ sort: e.target.value === fallback ? null : e.target.value })}
        className="border-line bg-canvas h-9 rounded-lg border px-2 text-sm"
        aria-label="Sort products"
      >
        {PRODUCT_SORTS.filter((s) => search || s !== "relevance").map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Removable chips for each active filter. */
export function ActiveFilters() {
  const { params, update } = useListingNav();
  const chips: { label: string; remove: () => void }[] = [];

  for (const key of ["size", "color", "fit"] as const) {
    const values = params.get(key)?.split(",").filter(Boolean) ?? [];
    for (const v of values) {
      chips.push({
        label:
          key === "fit"
            ? (FIT_LABEL[v as keyof typeof FIT_LABEL] ?? v)
            : key === "size"
              ? `Size ${v}`
              : v,
        remove: () => update({ [key]: values.filter((x) => x !== v).join(",") || null }),
      });
    }
  }
  const min = params.get("min");
  const max = params.get("max");
  if (min || max) {
    chips.push({
      label: `Rs ${min || "0"} – ${max || "any"}`,
      remove: () => update({ min: null, max: null }),
    });
  }
  if (params.get("inStock") === "true")
    chips.push({ label: "In stock", remove: () => update({ inStock: null }) });

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.remove}
          className="border-line hover:border-ink flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
          aria-label={`Remove filter: ${c.label}`}
        >
          {c.label} <span aria-hidden>×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          update({ size: null, color: null, fit: null, min: null, max: null, inStock: null })
        }
        className="text-muted text-xs underline"
      >
        Clear all
      </button>
    </div>
  );
}
