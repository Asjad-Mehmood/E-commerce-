"use client";

import { cn } from "@hoodie/ui";
import type { InputHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "border-line bg-canvas text-ink w-full rounded-lg border text-sm focus:border-ink focus:ring-ink/10 focus:outline-none focus:ring-2 disabled:bg-surface disabled:opacity-60";
const invalidCls = "border-danger focus:border-danger focus:ring-danger/15";

export function Select({
  className,
  invalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; ref?: Ref<HTMLSelectElement> }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(control, "h-10 px-3 pr-8", invalid && invalidCls, className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(control, "min-h-24 px-3 py-2", invalid && invalidCls, className)}
      {...props}
    />
  );
}

/** Checkbox with its label to the right. */
export function Checkbox({
  label,
  hint,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input
        type="checkbox"
        className="accent-ink mt-0.5 size-4 shrink-0 cursor-pointer"
        {...props}
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="text-muted block">{hint}</span>}
      </span>
    </label>
  );
}

/** An on/off switch (a checkbox styled as a toggle, so it works with forms and screen readers). */
export function Switch({
  label,
  hint,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", className)}>
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-muted block">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span className="bg-line peer-checked:bg-ink peer-focus-visible:ring-brand-500 h-6 w-11 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Text input with a fixed prefix or suffix, e.g. "Rs" or "%". */
export function AffixInput({
  prefix,
  suffix,
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <div
      className={cn(
        "border-line bg-canvas focus-within:border-ink focus-within:ring-ink/10 flex h-10 items-center rounded-lg border text-sm focus-within:ring-2",
        invalid && "border-danger focus-within:border-danger focus-within:ring-danger/15",
        className,
      )}
    >
      {prefix && <span className="text-muted pl-3">{prefix}</span>}
      <input
        aria-invalid={invalid || undefined}
        className="h-full min-w-0 flex-1 bg-transparent px-3 tabular-nums outline-none"
        {...props}
      />
      {suffix && <span className="text-muted pr-3">{suffix}</span>}
    </div>
  );
}
