"use client";

import type { PaginatedResponse, ProductCardDTO } from "@hoodie/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { readRecentlyViewed, rememberViewed } from "@/lib/recently-viewed";
import { ProductCard } from "./product-card";

/**
 * "Recently viewed" strip. Records `current` (a product page) and shows the
 * other products this browser looked at, newest first.
 */
export function RecentlyViewed({ current }: { current?: string }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    const all = current ? rememberViewed(current) : readRecentlyViewed();
    setSlugs(all.filter((s) => s !== current).slice(0, 8));
  }, [current]);

  const products = useQuery({
    queryKey: ["recently-viewed", slugs],
    queryFn: () =>
      api<PaginatedResponse<ProductCardDTO>>(`/products?slugs=${slugs.join(",")}&limit=8`),
    enabled: slugs.length > 0,
    staleTime: 60_000,
  });
  const items = products.data?.data ?? [];
  if (!items.length) return null;

  return (
    <section className="mt-20" aria-labelledby="recently-viewed">
      <h2 id="recently-viewed" className="mb-6 text-2xl font-bold tracking-tight">
        Recently viewed
      </h2>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-4">
        {items.slice(0, 4).map((p) => (
          <div key={p.id} className="w-40 shrink-0 snap-start sm:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
