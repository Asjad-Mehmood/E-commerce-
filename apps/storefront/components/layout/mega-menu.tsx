"use client";

import { cn } from "@hoodie/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../icons";
import type { NavData } from "./header";

/** "Shop" dropdown listing categories and collections. Opens on hover, click or keyboard. */
export function MegaMenu({ categories, collections }: NavData) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Hovering opens the menu; the click that usually follows must not close it again.
  const openedByHover = useRef(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => {
        openedByHover.current = !open;
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mega-menu"
        onClick={() => {
          if (openedByHover.current) {
            openedByHover.current = false;
            return;
          }
          setOpen((o) => !o);
        }}
        className="hover:bg-surface flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium"
      >
        Shop <ChevronDownIcon className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <div
        id="mega-menu"
        hidden={!open}
        className="border-line bg-canvas absolute left-0 top-full z-50 w-[560px] rounded-2xl border p-6 shadow-xl"
      >
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-muted text-xs font-semibold uppercase tracking-wider">Categories</p>
            <ul className="mt-3 space-y-1">
              <li>
                <Link
                  href="/shop"
                  className="hover:bg-surface block rounded-lg px-2 py-1.5 text-sm font-semibold"
                >
                  All hoodies
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="hover:bg-surface flex justify-between rounded-lg px-2 py-1.5 text-sm"
                  >
                    {c.name}
                    <span className="text-muted">{c.productCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-muted text-xs font-semibold uppercase tracking-wider">Collections</p>
            <ul className="mt-3 space-y-1">
              {collections.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/collections/${c.slug}`}
                    className="hover:bg-surface block rounded-lg px-2 py-1.5 text-sm"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
