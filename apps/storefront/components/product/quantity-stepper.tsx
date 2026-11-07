"use client";

import { cn } from "@hoodie/ui";
import { MinusIcon, PlusIcon } from "../icons";

export function QuantityStepper({
  value,
  onChange,
  max,
  min = 1,
  disabled,
  label = "Quantity",
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  min?: number;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
}) {
  const btn = cn(
    "grid place-items-center disabled:opacity-30 hover:bg-surface",
    size === "sm" ? "size-8" : "size-10",
  );
  return (
    <div
      role="group"
      aria-label={label}
      className="border-line inline-flex items-center rounded-lg border"
    >
      <button
        type="button"
        className={btn}
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon />
      </button>
      <span
        aria-live="polite"
        className={cn(
          "text-center text-sm font-medium tabular-nums",
          size === "sm" ? "w-7" : "w-10",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
