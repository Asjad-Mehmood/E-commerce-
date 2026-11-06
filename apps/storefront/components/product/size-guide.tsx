"use client";

import type { Fit } from "@hoodie/types";
import { FITS } from "@hoodie/types";
import { Button, cn, Dialog, Input } from "@hoodie/ui";
import { useState } from "react";
import { FIT_DESCRIPTION, FIT_LABEL, recommendSize, SIZE_CHARTS } from "@/lib/size-guide";
import { RulerIcon } from "../icons";

export function SizeTable({ fit, highlight }: { fit: Fit; highlight?: string | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="text-muted mb-2 text-left text-xs">
          Garment measurements in inches, laid flat and doubled for chest.
        </caption>
        <thead>
          <tr className="border-line border-b text-left">
            <th scope="col" className="py-2 font-semibold">
              Size
            </th>
            <th scope="col" className="py-2 font-semibold">
              Chest
            </th>
            <th scope="col" className="py-2 font-semibold">
              Length
            </th>
            <th scope="col" className="py-2 font-semibold">
              Sleeve
            </th>
          </tr>
        </thead>
        <tbody>
          {SIZE_CHARTS[fit].map((row) => (
            <tr
              key={row.size}
              className={cn(
                "border-line border-b",
                row.size === highlight && "bg-brand-50 font-semibold",
              )}
            >
              <th scope="row" className="py-2 font-medium">
                {row.size}
              </th>
              <td className="py-2 tabular-nums">{row.chest}</td>
              <td className="py-2 tabular-nums">{row.length}</td>
              <td className="py-2 tabular-nums">{row.sleeve}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Find my size": suggests a size from the customer's chest measurement. */
export function SizeFinder({
  fit,
  available,
  onPick,
}: {
  fit: Fit;
  available?: string[];
  onPick?: (size: string) => void;
}) {
  const [chest, setChest] = useState("");
  const value = Number(chest);
  const result =
    chest && value > 20 && value < 70 ? recommendSize(value, fit, available) : undefined;

  return (
    <div className="bg-surface rounded-xl p-4">
      <p className="text-sm font-semibold">Find my size</p>
      <label className="mt-2 block text-sm">
        <span className="text-muted">Your chest measurement (inches)</span>
        <Input
          type="number"
          inputMode="decimal"
          min={20}
          max={70}
          value={chest}
          onChange={(e) => setChest(e.target.value)}
          placeholder="e.g. 38"
          className="mt-1 max-w-40"
        />
      </label>
      {result !== undefined && (
        <p className="mt-3 text-sm" role="status">
          {result ? (
            <>
              We recommend <strong>{result}</strong> in our {FIT_LABEL[fit].toLowerCase()}.
              {onPick && (
                <Button size="sm" variant="outline" className="ml-2" onClick={() => onPick(result)}>
                  Select {result}
                </Button>
              )}
            </>
          ) : (
            "This style may run small for you. Contact us for advice."
          )}
        </p>
      )}
    </div>
  );
}

export function SizeGuideDialog({
  fit,
  available,
  onPick,
}: {
  fit: Fit;
  available: string[];
  onPick: (size: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted hover:text-ink flex items-center gap-1.5 text-sm underline"
      >
        <RulerIcon /> Size guide
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Size guide · ${FIT_LABEL[fit]}`}>
        <p className="text-muted mb-4 text-sm">{FIT_DESCRIPTION[fit]}</p>
        <SizeTable fit={fit} highlight={chosen} />
        <div className="mt-4">
          <SizeFinder
            fit={fit}
            available={available}
            onPick={(size) => {
              setChosen(size);
              onPick(size);
              setOpen(false);
            }}
          />
        </div>
      </Dialog>
    </>
  );
}

export const ALL_FITS = FITS;
