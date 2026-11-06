"use client";

import Link from "next/link";
import { useMe } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useUi } from "@/store/ui";
import { BagIcon, SearchIcon, UserIcon } from "../icons";

export function HeaderActions() {
  const me = useMe();
  const cart = useCart();
  const openCart = useUi((s) => s.openCart);
  const count = cart.data?.itemCount ?? 0;
  const firstName = me.data?.name.split(" ")[0];

  return (
    <div className="ml-auto flex items-center gap-1">
      <Link href="/search" aria-label="Search" className="hover:bg-surface rounded-lg p-2">
        <SearchIcon />
      </Link>
      <Link
        href={me.data ? "/account" : "/login"}
        aria-label={me.data ? "My account" : "Sign in"}
        className="hover:bg-surface flex items-center gap-2 rounded-lg p-2"
      >
        <UserIcon />
        <span className="hidden text-sm font-medium xl:inline">{firstName ?? "Sign in"}</span>
      </Link>
      <button
        type="button"
        onClick={openCart}
        aria-label={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
        className="hover:bg-surface relative rounded-lg p-2"
      >
        <BagIcon />
        {count > 0 && (
          <span
            data-testid="cart-count"
            className="bg-brand-600 absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white"
          >
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
