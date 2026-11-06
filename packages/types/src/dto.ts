/**
 * Response shapes (DTOs) returned by the API and consumed by the frontends.
 * All money fields are integers in minor units.
 */
import type { Fit, ProductStatus, Role } from "./enums";

// ───────────── Auth ─────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
}

export interface AddressDTO {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

// ───────────── Catalog ─────────────

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface ImageDTO {
  url: string;
  alt: string | null;
  color: string | null;
}

export interface ColorOption {
  name: string;
  hex: string | null;
}

/** Compact product used in grids, search results and related products. */
export interface ProductCardDTO {
  id: string;
  slug: string;
  title: string;
  fit: Fit;
  /** Lowest selling price across active variants. */
  price: number;
  compareAtPrice: number | null;
  /** True when variants have different prices, so the UI should show "from". */
  hasPriceRange: boolean;
  discountPercent: number;
  image: ImageDTO | null;
  /** Second image, shown on hover. */
  hoverImage: ImageDTO | null;
  colors: ColorOption[];
  /** Sizes with available stock. */
  sizesInStock: string[];
  inStock: boolean;
  isFeatured: boolean;
  avgRating: number;
  reviewCount: number;
}

export interface VariantDTO {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number;
  stockStatus: StockStatus;
  /** Units left, only exposed when stock is low (e.g. "Only 3 left"). */
  lowStockCount: number | null;
}

export interface TaxonomyRef {
  id: string;
  slug: string;
  name: string;
}

export interface ProductDetailDTO extends Omit<ProductCardDTO, "image" | "hoverImage"> {
  description: string;
  fabric: string | null;
  careInfo: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  images: ImageDTO[];
  variants: VariantDTO[];
  sizes: string[];
  categories: TaxonomyRef[];
  collections: TaxonomyRef[];
}

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  productCount: number;
  children: CategoryDTO[];
}

export interface CollectionDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  isFeatured: boolean;
  productCount: number;
}

export interface FiltersDTO {
  sizes: string[];
  colors: ColorOption[];
  fits: Fit[];
  price: { min: number; max: number };
}

// ───────────── Cart ─────────────

export interface CartItemDTO {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  image: ImageDTO | null;
  size: string;
  color: string;
  sku: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  /** Most the customer can buy right now (available stock, capped per item). */
  maxQuantity: number;
  stockStatus: StockStatus;
  /** False if the product was unpublished or the variant disabled. */
  isAvailable: boolean;
}

export interface CartDTO {
  id: string | null;
  items: CartItemDTO[];
  itemCount: number;
  subtotal: number;
  currency: string;
  /** Problems to fix before checkout, e.g. "Only 2 left of Classic Hoodie (M, Black)". */
  warnings: string[];
}

// ───────────── Admin ─────────────

export interface AdminVariantDTO {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number | null;
  effectivePrice: number;
  stock: number;
  reserved: number;
  available: number;
  lowStockAt: number;
  weightGrams: number | null;
  isActive: boolean;
}

export interface AdminProductListItemDTO {
  id: string;
  slug: string;
  title: string;
  status: ProductStatus;
  basePrice: number;
  image: string | null;
  variantCount: number;
  totalStock: number;
  soldCount: number;
  updatedAt: string;
}

// ───────────── Content (CMS) ─────────────

export interface BannerDTO {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string | null;
  ctaLabel: string | null;
}

export interface HomeContentDTO {
  announcement: string | null;
  banners: BannerDTO[];
}

export interface PageDTO {
  slug: string;
  title: string;
  content: string;
  seoDescription: string | null;
  updatedAt: string;
}

export interface FaqDTO {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}
