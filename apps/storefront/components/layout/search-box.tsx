"use client";

import type { ApiResponse, SearchSuggestionsDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { Dialog, cn } from "@hoodie/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { SearchIcon } from "../icons";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Option = { href: string; label: string; kind: "product" | "category" | "all" };

/** Header search: a dialog with search-as-you-type suggestions (combobox pattern). */
export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const term = useDebounced(q.trim(), 200);

  const suggestions = useQuery({
    queryKey: ["search-suggest", term],
    queryFn: async () =>
      (
        await api<ApiResponse<SearchSuggestionsDTO>>(
          `/search/suggest?q=${encodeURIComponent(term)}`,
        )
      ).data,
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const data = term.length >= 2 ? suggestions.data : undefined;

  const options: Option[] = [
    ...(data?.products.map((p) => ({
      href: `/products/${p.slug}`,
      label: p.title,
      kind: "product" as const,
    })) ?? []),
    ...(data?.categories.map((c) => ({
      href: `/categories/${c.slug}`,
      label: c.name,
      kind: "category" as const,
    })) ?? []),
    ...(q.trim()
      ? [
          {
            href: `/search?q=${encodeURIComponent(q.trim())}`,
            label: `See all results for "${q.trim()}"`,
            kind: "all" as const,
          },
        ]
      : []),
  ];

  useEffect(() => setActive(-1), [term]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[active];
      if (option) go(option.href);
      else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <>
      <button
        type="button"
        aria-label="Open search"
        onClick={() => setOpen(true)}
        className="hover:bg-surface rounded-lg p-2"
      >
        <SearchIcon />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Search"
        hideTitle
        className="mb-auto mt-[10vh] max-w-xl"
      >
        <div className="space-y-3">
          <input
            type="search"
            role="combobox"
            aria-label="Search hoodies"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search hoodies, e.g. zip, oversized, sherpa"
            className="border-line focus:border-ink focus:ring-ink/10 h-12 w-full rounded-lg border px-4 text-base focus:outline-none focus:ring-2"
            autoFocus
          />
          <ul id={listId} role="listbox" aria-label="Suggestions" className="space-y-0.5">
            {options.map((o, i) => {
              const product =
                o.kind === "product"
                  ? data?.products.find((p) => `/products/${p.slug}` === o.href)
                  : undefined;
              return (
                <li
                  key={o.href}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(o.href)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm",
                    i === active && "bg-surface",
                  )}
                >
                  {o.kind === "product" ? (
                    <>
                      <span className="bg-surface relative size-10 shrink-0 overflow-hidden rounded-md">
                        {product?.image && (
                          <Image
                            src={product.image}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <span className="flex-1 font-medium">{o.label}</span>
                      {product && <span className="text-muted">{formatMoney(product.price)}</span>}
                    </>
                  ) : o.kind === "category" ? (
                    <span>
                      <span className="text-muted">Category: </span>
                      <span className="font-medium">{o.label}</span>
                    </span>
                  ) : (
                    <span className="font-medium underline">{o.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {term.length >= 2 &&
            data &&
            data.products.length === 0 &&
            data.categories.length === 0 && (
              <p className="text-muted px-2 text-sm">
                No matches yet. Press Enter to search anyway.
              </p>
            )}
        </div>
      </Dialog>
    </>
  );
}
