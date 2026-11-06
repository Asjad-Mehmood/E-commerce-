import type { AdminVariantDTO, Fit, ProductStatus } from "@hoodie/types";

/** GET /admin/products/:id */
export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  description: string;
  fit: Fit;
  fabric: string | null;
  careInfo: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  status: ProductStatus;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  soldCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categories: { id: string; slug: string; name: string }[];
  collections: { id: string; slug: string; name: string }[];
  images: { id: string; url: string; alt: string | null; color: string | null; position: number }[];
  variants: AdminVariantDTO[];
}

export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  _count: { products: number };
}
