"use client";

import { Card, Container, Skeleton } from "@hoodie/ui";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { CartLine } from "./cart-line";
import { CartSummary } from "./cart-summary";

export function CartPageContent() {
  const { data: cart, isLoading, isError, refetch } = useCart();

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight">Your cart</h1>

      {isLoading ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-48" />
        </div>
      ) : isError ? (
        <div className="mt-8">
          <p>We couldn’t load your cart.</p>
          <button type="button" onClick={() => refetch()} className="mt-2 underline">
            Try again
          </button>
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div className="bg-surface mt-8 rounded-2xl px-6 py-20 text-center">
          <p className="text-lg font-semibold">Your cart is empty</p>
          <p className="text-muted mt-2 text-sm">Items you add will appear here.</p>
          <Link
            href="/shop"
            className="bg-ink mt-6 inline-flex h-11 items-center rounded-lg px-6 text-sm font-semibold text-white"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <section aria-label="Cart items">
            {cart.warnings.length > 0 && (
              <ul
                role="alert"
                className="bg-danger/10 text-danger mb-4 space-y-1 rounded-lg p-4 text-sm"
              >
                {cart.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <ul className="divide-line border-line divide-y border-y">
              {cart.items.map((item) => (
                <CartLine key={item.id} item={item} />
              ))}
            </ul>
            <Link href="/shop" className="mt-6 inline-block text-sm font-medium underline">
              ← Continue shopping
            </Link>
          </section>
          <Card className="lg:sticky lg:top-24">
            <h2 className="mb-4 font-semibold">Order summary</h2>
            <CartSummary cart={cart} />
          </Card>
        </div>
      )}
    </Container>
  );
}
