import type { ProductCardDTO } from "@hoodie/types";
import { Badge } from "@hoodie/ui";
import Image from "next/image";
import Link from "next/link";
import { FIT_LABEL } from "@/lib/size-guide";
import { Price } from "./price";
import { Stars } from "./stars";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardDTO;
  priority?: boolean;
}) {
  const { image, hoverImage } = product;
  return (
    <article className="group relative">
      <WishlistButton productId={product.id} title={product.title} />
      <Link href={`/products/${product.slug}`} className="block">
        <div className="bg-surface relative aspect-[4/5] overflow-hidden rounded-xl">
          {image && (
            <Image
              src={image.url}
              alt={image.alt ?? product.title}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-opacity duration-300 group-hover:opacity-0 group-focus-visible:opacity-0"
            />
          )}
          {hoverImage && (
            <Image
              src={hoverImage.url}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          )}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {!product.inStock && (
              <Badge className="bg-ink border-transparent text-white">Sold out</Badge>
            )}
            {product.inStock && product.discountPercent > 0 && (
              <Badge className="bg-danger border-transparent text-white">
                -{product.discountPercent}%
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <h3 className="text-sm font-medium leading-snug group-hover:underline">
            {product.title}
          </h3>
          <p className="text-muted text-xs">{FIT_LABEL[product.fit]}</p>
          {product.reviewCount > 0 && (
            <p className="text-muted flex items-center gap-1.5 text-xs">
              <Stars rating={product.avgRating} size={12} />
              <span>
                ({product.reviewCount}
                <span className="sr-only"> reviews</span>)
              </span>
            </p>
          )}
          <Price
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            from={product.hasPriceRange}
            className="text-sm"
          />
        </div>
      </Link>
      {product.colors.length > 1 && (
        <ul className="mt-2 flex gap-1.5" aria-label={`${product.colors.length} colours`}>
          {product.colors.map((c) => (
            <li
              key={c.name}
              title={c.name}
              className="border-line size-3.5 rounded-full border"
              style={{ backgroundColor: c.hex ?? undefined }}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: ProductCardDTO[];
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
