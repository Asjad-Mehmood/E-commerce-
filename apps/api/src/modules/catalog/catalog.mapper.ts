import {
  compareSizes,
  discountPercent,
  type ColorOption,
  type ImageDTO,
  type ProductCardDTO,
  type ProductDetailDTO,
  type StockStatus,
  type VariantDTO,
} from "@hoodie/types";
import type { Prisma } from "@prisma/client";

/** Units that can still be sold (stock minus units held by unpaid checkouts). */
export const available = (v: { stock: number; reserved: number }) =>
  Math.max(0, v.stock - v.reserved);

export function stockStatus(v: {
  stock: number;
  reserved: number;
  lowStockAt: number;
}): StockStatus {
  const n = available(v);
  if (n === 0) return "out_of_stock";
  return n <= v.lowStockAt ? "low_stock" : "in_stock";
}

export const effectivePrice = (variant: { price: number | null }, basePrice: number) =>
  variant.price ?? basePrice;

const variantFields = {
  id: true,
  sku: true,
  size: true,
  color: true,
  colorHex: true,
  price: true,
  stock: true,
  reserved: true,
  lowStockAt: true,
  createdAt: true,
} as const;

const imageFields = { url: true, alt: true, color: true } as const;

/** Prisma `include` for product cards (only active variants, first two images). */
export const cardInclude = {
  variants: { where: { isActive: true }, select: variantFields, orderBy: { createdAt: "asc" } },
  images: { select: imageFields, orderBy: { position: "asc" }, take: 2 },
} satisfies Prisma.ProductInclude;

export const detailInclude = {
  variants: { where: { isActive: true }, select: variantFields, orderBy: { createdAt: "asc" } },
  images: { select: imageFields, orderBy: { position: "asc" } },
  categories: { select: { id: true, slug: true, name: true } },
  collections: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.ProductInclude;

type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;
type DetailProduct = Prisma.ProductGetPayload<{ include: typeof detailInclude }>;
type Variant = CardProduct["variants"][number];

/** Colours in the order their first variant was created (the admin's intended order). */
function colorsOf(variants: Variant[]): ColorOption[] {
  const seen = new Map<string, ColorOption>();
  for (const v of variants) {
    if (!seen.has(v.color)) seen.set(v.color, { name: v.color, hex: v.colorHex });
  }
  return [...seen.values()];
}

function pricing(p: { basePrice: number; compareAtPrice: number | null; variants: Variant[] }) {
  const prices = p.variants.map((v) => effectivePrice(v, p.basePrice));
  const price = prices.length ? Math.min(...prices) : p.basePrice;
  return {
    price,
    compareAtPrice: p.compareAtPrice,
    hasPriceRange: new Set(prices).size > 1,
    discountPercent: discountPercent(price, p.compareAtPrice),
  };
}

const toImage = (img: { url: string; alt: string | null; color: string | null }): ImageDTO => ({
  url: img.url,
  alt: img.alt,
  color: img.color,
});

function common(p: CardProduct | DetailProduct) {
  const inStockVariants = p.variants.filter((v) => available(v) > 0);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    fit: p.fit,
    ...pricing(p),
    colors: colorsOf(p.variants),
    sizesInStock: [...new Set(inStockVariants.map((v) => v.size))].sort(compareSizes),
    inStock: inStockVariants.length > 0,
    isFeatured: p.isFeatured,
    avgRating: p.avgRating,
    reviewCount: p.reviewCount,
  };
}

export function toProductCard(p: CardProduct): ProductCardDTO {
  return {
    ...common(p),
    image: p.images[0] ? toImage(p.images[0]) : null,
    hoverImage: p.images[1] ? toImage(p.images[1]) : null,
  };
}

function toVariant(v: Variant, basePrice: number): VariantDTO {
  const status = stockStatus(v);
  return {
    id: v.id,
    sku: v.sku,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    price: effectivePrice(v, basePrice),
    stockStatus: status,
    // Exact stock is never exposed, except "only N left" when it is low.
    lowStockCount: status === "low_stock" ? available(v) : null,
  };
}

export function toProductDetail(p: DetailProduct): ProductDetailDTO {
  const colorOrder = colorsOf(p.variants).map((c) => c.name);
  const variants = [...p.variants].sort(
    (a, b) =>
      colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color) || compareSizes(a.size, b.size),
  );

  return {
    ...common(p),
    description: p.description,
    fabric: p.fabric,
    careInfo: p.careInfo,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    images: p.images.map(toImage),
    variants: variants.map((v) => toVariant(v, p.basePrice)),
    sizes: [...new Set(p.variants.map((v) => v.size))].sort(compareSizes),
    categories: p.categories,
    collections: p.collections,
  };
}
