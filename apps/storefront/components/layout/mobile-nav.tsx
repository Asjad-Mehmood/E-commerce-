"use client";

import { Dialog } from "@hoodie/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-auth";
import { useUi } from "@/store/ui";
import { MenuIcon } from "../icons";
import type { NavData } from "./header";

export function MobileNavButton() {
  const setMenuOpen = useUi((s) => s.setMenuOpen);
  return (
    <button
      type="button"
      aria-label="Open menu"
      onClick={() => setMenuOpen(true)}
      className="hover:bg-surface -ml-2 rounded-lg p-2 lg:hidden"
    >
      <MenuIcon />
    </button>
  );
}

const linkClass = "hover:bg-surface block rounded-lg px-3 py-2.5 font-medium";

export function MobileNav({ categories, collections }: NavData) {
  const { menuOpen, setMenuOpen } = useUi();
  const pathname = usePathname();
  const me = useMe();

  useEffect(() => setMenuOpen(false), [pathname, setMenuOpen]);

  return (
    <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" variant="left">
      <nav aria-label="Mobile" className="space-y-6">
        <div>
          <Link href="/shop" className={linkClass}>
            All hoodies
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className={linkClass}>
              {c.name}
            </Link>
          ))}
        </div>
        <div>
          <p className="text-muted px-3 text-xs font-semibold uppercase tracking-wider">
            Collections
          </p>
          {collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.slug}`} className={linkClass}>
              {c.name}
            </Link>
          ))}
        </div>
        <div className="border-line border-t pt-4">
          <Link href={me.data ? "/account" : "/login"} className={linkClass}>
            {me.data ? "My account" : "Sign in / Create account"}
          </Link>
          <Link href="/size-guide" className={linkClass}>
            Size guide
          </Link>
          <Link href="/faq" className={linkClass}>
            Help & FAQ
          </Link>
        </div>
      </nav>
    </Dialog>
  );
}
