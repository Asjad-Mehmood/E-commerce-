"use client";

import type { FiltersDTO } from "@hoodie/types";
import { Button, cn, Dialog, Input } from "@hoodie/ui";
import { useState } from "react";
import { FIT_LABEL } from "@/lib/size-guide";
import { FilterIcon } from "../icons";
import { useListingNav } from "./listing-nav";

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function useListParam(key: string) {
  const { params, update } = useListingNav();
  const values = params.get(key)?.split(",").filter(Boolean) ?? [];
  return [
    values,
    (value: string) => update({ [key]: toggle(values, value).join(",") || null }),
  ] as const;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-line border-b py-5 first:pt-0">
      {/* float: a plain <legend> ignores the fieldset's padding, causing uneven gaps */}
      <legend className="float-left mb-3 w-full text-sm font-semibold">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

function PriceFilter({ range }: { range: FiltersDTO["price"] }) {
  const { params, update } = useListingNav();
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const lo = Math.floor(range.min / 100);
  const hi = Math.ceil(range.max / 100);

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        update({ min: min || null, max: max || null });
      }}
    >
      <label className="flex-1 text-xs">
        <span className="text-muted">Min (Rs)</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(lo)}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="mt-1 h-9"
        />
      </label>
      <label className="flex-1 text-xs">
        <span className="text-muted">Max (Rs)</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(hi)}
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className="mt-1 h-9"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" className="h-9">
        Go
      </Button>
    </form>
  );
}

export function FilterPanel({ filters }: { filters: FiltersDTO }) {
  const { params, update } = useListingNav();
  const [sizes, toggleSize] = useListParam("size");
  const [colors, toggleColor] = useListParam("color");
  const [fits, toggleFit] = useListParam("fit");
  const inStock = params.get("inStock") === "true";

  return (
    <div>
      {filters.sizes.length > 0 && (
        <Section title="Size">
          <div className="grid grid-cols-3 gap-2">
            {filters.sizes.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={sizes.includes(size)}
                onClick={() => toggleSize(size)}
                className={cn(
                  "h-9 rounded-lg border text-sm font-medium",
                  sizes.includes(size)
                    ? "border-ink bg-ink text-white"
                    : "border-line hover:border-ink",
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </Section>
      )}

      {filters.colors.length > 0 && (
        <Section title="Colour">
          <ul className="space-y-1">
            {filters.colors.map((c) => (
              <li key={c.name}>
                <label className="hover:bg-surface flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={colors.includes(c.name)}
                    onChange={() => toggleColor(c.name)}
                    className="accent-ink size-4"
                  />
                  <span
                    className="border-line size-4 rounded-full border"
                    style={{ backgroundColor: c.hex ?? undefined }}
                  />
                  {c.name}
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {filters.fits.length > 1 && (
        <Section title="Fit">
          <ul className="space-y-1">
            {filters.fits.map((fit) => (
              <li key={fit}>
                <label className="hover:bg-surface flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={fits.includes(fit)}
                    onChange={() => toggleFit(fit)}
                    className="accent-ink size-4"
                  />
                  {FIT_LABEL[fit]}
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Price">
        <PriceFilter key={`${params.get("min")}-${params.get("max")}`} range={filters.price} />
      </Section>

      <div className="py-5">
        <label className="flex cursor-pointer items-center justify-between text-sm font-medium">
          In stock only
          <input
            type="checkbox"
            role="switch"
            checked={inStock}
            onChange={() => update({ inStock: inStock ? null : "true" })}
            className="accent-ink size-4"
          />
        </label>
      </div>
    </div>
  );
}

/** Mobile: the same panel inside a drawer. */
export function MobileFilters({
  filters,
  activeCount,
  resultCount,
}: {
  filters: FiltersDTO;
  activeCount: number;
  resultCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="lg:hidden">
        <FilterIcon /> Filters{activeCount > 0 && ` (${activeCount})`}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filters"
        variant="left"
        footer={
          <Button className="w-full" onClick={() => setOpen(false)}>
            Show {resultCount} {resultCount === 1 ? "result" : "results"}
          </Button>
        }
      >
        <FilterPanel filters={filters} />
      </Dialog>
    </>
  );
}
