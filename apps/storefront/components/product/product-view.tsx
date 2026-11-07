"use client";

import type { ProductDetailDTO, VariantDTO } from "@hoodie/types";
import { MAX_QTY_PER_ITEM } from "@hoodie/validation";
import { Badge, Button, cn } from "@hoodie/ui";
import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAddToCart } from "@/hooks/use-cart";
import { ApiError } from "@/lib/api";
import { FIT_LABEL } from "@/lib/size-guide";
import { useUi } from "@/store/ui";
import { NotifyMe } from "./notify-me";
import { Price } from "./price";
import { QuantityStepper } from "./quantity-stepper";
import { SizeGuideDialog } from "./size-guide";
import { Stars } from "./stars";
import { WishlistButton } from "./wishlist-button";

function Gallery({ images, title }: { images: ProductDetailDTO["images"]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto sm:flex-col" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active}
                className={cn(
                  "bg-surface relative block aspect-[4/5] w-16 overflow-hidden rounded-lg border-2 sm:w-20",
                  i === active ? "border-ink" : "border-transparent",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="bg-surface relative aspect-[4/5] flex-1 overflow-hidden rounded-2xl">
        {current && (
          <Image
            key={current.url}
            src={current.url}
            alt={current.alt ?? title}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
    </div>
  );
}

const firstAvailable = (variants: VariantDTO[]) =>
  variants.find((v) => v.stockStatus !== "out_of_stock");

/** Gallery + colour/size/quantity selection + add to cart. */
export function ProductView({ product }: { product: ProductDetailDTO }) {
  const addToCart = useAddToCart();
  const openCart = useUi((s) => s.openCart);

  const [color, setColor] = useState(
    () => firstAvailable(product.variants)?.color ?? product.colors[0]?.name ?? "",
  );
  const [size, setSize] = useState<string | null>(() =>
    product.sizes.length === 1 ? product.sizes[0]! : null,
  );
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);

  const colorVariants = useMemo(
    () => product.variants.filter((v) => v.color === color),
    [product.variants, color],
  );
  const variant = colorVariants.find((v) => v.size === size) ?? null;
  const images = useMemo(() => {
    const forColor = product.images.filter((i) => i.color === color);
    return forColor.length ? forColor : product.images;
  }, [product.images, color]);

  const soldOut = variant?.stockStatus === "out_of_stock";
  const maxQty = Math.min(variant?.lowStockCount ?? MAX_QTY_PER_ITEM, MAX_QTY_PER_ITEM);

  function selectSize(s: string) {
    setSize(s);
    setSizeError(false);
    setQuantity(1);
  }

  function add() {
    if (!variant) {
      setSizeError(true);
      return;
    }
    addToCart.mutate(
      { variantId: variant.id, quantity },
      {
        onSuccess: () => {
          openCart();
          setQuantity(1);
        },
        onError: (err) =>
          toast.error(
            err instanceof ApiError ? err.message : "Could not add to cart. Please try again.",
          ),
      },
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
      <Gallery key={color} images={images} title={product.title} />

      <div>
        <div className="flex flex-wrap gap-2">
          <Badge>{FIT_LABEL[product.fit]}</Badge>
          {product.discountPercent > 0 && (
            <Badge tone="danger">Save {product.discountPercent}%</Badge>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{product.title}</h1>
        {product.reviewCount > 0 && (
          <a
            href="#reviews"
            className="mt-2 inline-flex items-center gap-2 text-sm hover:underline"
          >
            <Stars rating={product.avgRating} size={14} />
            <span className="text-muted">
              {product.avgRating.toFixed(1)} · {product.reviewCount} review
              {product.reviewCount === 1 ? "" : "s"}
            </span>
          </a>
        )}
        <Price
          price={variant?.price ?? product.price}
          compareAtPrice={product.compareAtPrice}
          from={!variant && product.hasPriceRange}
          className="mt-3 text-xl"
        />

        {/* Colour */}
        <fieldset className="mt-8">
          <legend className="text-sm font-semibold">
            Colour: <span className="text-muted font-normal">{color}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.colors.map((c) => {
              const allSoldOut = product.variants
                .filter((v) => v.color === c.name)
                .every((v) => v.stockStatus === "out_of_stock");
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.name)}
                  aria-pressed={c.name === color}
                  aria-label={`${c.name}${allSoldOut ? " (sold out)" : ""}`}
                  title={c.name}
                  className={cn(
                    "relative size-10 rounded-full border-2 p-0.5 transition",
                    c.name === color ? "border-ink" : "hover:border-line border-transparent",
                  )}
                >
                  <span
                    className="border-line block size-full rounded-full border"
                    style={{ backgroundColor: c.hex ?? undefined }}
                  />
                  {allSoldOut && (
                    <span
                      aria-hidden
                      className="bg-muted absolute left-0 top-1/2 h-0.5 w-full -rotate-45"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Size */}
        <fieldset className="mt-6" aria-describedby={sizeError ? "size-error" : undefined}>
          <div className="flex items-center justify-between">
            <legend className="text-sm font-semibold">
              Size{size && <span className="text-muted font-normal">: {size}</span>}
            </legend>
            <SizeGuideDialog
              fit={product.fit}
              available={colorVariants
                .filter((v) => v.stockStatus !== "out_of_stock")
                .map((v) => v.size)}
              onPick={selectSize}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {product.sizes.map((s) => {
              const v = colorVariants.find((x) => x.size === s);
              const unavailable = !v || v.stockStatus === "out_of_stock";
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!v}
                  onClick={() => selectSize(s)}
                  aria-pressed={s === size}
                  aria-label={`Size ${s}${unavailable ? ", sold out" : ""}`}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-30",
                    s === size ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                    unavailable && s !== size && "text-muted line-through",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {sizeError && (
            <p id="size-error" role="alert" className="text-danger mt-2 text-sm">
              Please choose a size.
            </p>
          )}
          {variant?.stockStatus === "low_stock" && (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium" role="status">
              <span aria-hidden className="bg-warning size-2 rounded-full" />
              Hurry, only {variant.lowStockCount} left in {variant.size}.
            </p>
          )}
        </fieldset>

        {/* Purchase */}
        <div className="mt-8">
          {variant && soldOut ? (
            <div className="space-y-3">
              <NotifyMe
                key={variant.id}
                variantId={variant.id}
                label={`${product.title} (${variant.color}, ${variant.size})`}
              />
              <WishlistButton
                productId={product.id}
                title={product.title}
                variant="button"
                withText
                className="w-full"
              />
            </div>
          ) : (
            <div className="flex gap-3">
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                max={maxQty}
                disabled={!variant}
              />
              <Button
                size="lg"
                className="flex-1"
                onClick={add}
                loading={addToCart.isPending}
                disabled={!product.inStock}
              >
                {product.inStock ? "Add to cart" : "Sold out"}
              </Button>
              <WishlistButton productId={product.id} title={product.title} variant="button" />
            </div>
          )}
        </div>

        <ul className="text-muted mt-6 space-y-1 text-sm">
          <li>✓ Free exchanges within 14 days</li>
          <li>✓ Cash on Delivery available</li>
        </ul>
      </div>
    </div>
  );
}
