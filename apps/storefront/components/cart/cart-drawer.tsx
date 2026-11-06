"use client";

import { Dialog, Skeleton } from "@hoodie/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useCart } from "@/hooks/use-cart";
import { useUi } from "@/store/ui";
import { CartLine } from "./cart-line";
import { CartSummary } from "./cart-summary";

export function CartDrawer() {
  const { cartOpen, closeCart } = useUi();
  const { data: cart, isLoading } = useCart();
  const pathname = usePathname();

  useEffect(() => closeCart(), [pathname, closeCart]);

  const count = cart?.itemCount ?? 0;
  return (
    <Dialog
      open={cartOpen}
      onClose={closeCart}
      variant="right"
      title={`Your cart${count ? ` (${count})` : ""}`}
      footer={
        cart && cart.items.length > 0 ? (
          <div className="space-y-3">
            <CartSummary cart={cart} />
            <Link href="/cart" className="block text-center text-sm font-medium underline">
              View full cart
            </Link>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-medium">Your cart is empty</p>
          <p className="text-muted mt-1 text-sm">Find your next favourite hoodie.</p>
          <Link
            href="/shop"
            className="bg-ink mt-6 inline-flex h-10 items-center rounded-lg px-5 text-sm font-semibold text-white"
          >
            Shop hoodies
          </Link>
        </div>
      ) : (
        <>
          {cart.warnings.length > 0 && (
            <div role="alert" className="bg-danger/10 text-danger mb-2 rounded-lg p-3 text-sm">
              Some items need your attention before checkout.
            </div>
          )}
          <ul className="divide-line divide-y">
            {cart.items.map((item) => (
              <CartLine key={item.id} item={item} compact />
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
