"use client";

import { Skeleton } from "@hoodie/ui";
import Link from "next/link";
import { ProductGrid } from "@/components/product/product-card";
import { useWishlist } from "@/hooks/use-wishlist";

export function Wishlist() {
  const list = useWishlist();
  return (
    <div>
      <h2 className="text-xl font-semibold">Wishlist</h2>
      <p className="text-muted mt-1 text-sm">
        Hoodies you&apos;ve saved. Tap the heart on any product to add or remove it.
      </p>
      <div className="mt-6">
        {list.isPending ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-[4/5]" />
            ))}
          </div>
        ) : list.data?.length ? (
          <ProductGrid products={list.data} />
        ) : (
          <div className="border-line rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">Nothing saved yet</p>
            <Link href="/shop" className="mt-3 inline-block text-sm underline">
              Browse hoodies
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
