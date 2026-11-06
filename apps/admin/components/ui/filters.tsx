"use client";

import { Input } from "@hoodie/ui";
import { useEffect, useRef, useState } from "react";
import { useDebounced } from "@/hooks/use-url-state";

/** Search box that reports its value after typing pauses. */
export function SearchBox({
  value,
  onSearch,
  placeholder = "Search",
  label = "Search",
  className,
}: {
  value: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const debounced = useDebounced(text, 350);
  const last = useRef(value);

  // Follow outside changes (e.g. "Clear filters").
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (debounced.trim() !== last.current) {
      last.current = debounced.trim();
      onSearch(debounced.trim());
    }
  }, [debounced, onSearch]);

  return (
    <Input
      type="search"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      className={className ?? "sm:max-w-xs"}
    />
  );
}

/** Pill-style filter tabs (e.g. order status). */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={
            o.value === value
              ? "bg-ink rounded-full px-3 py-1 text-sm font-medium text-white"
              : "border-line text-ink hover:bg-surface rounded-full border px-3 py-1 text-sm"
          }
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
