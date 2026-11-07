/**
 * Response shapes (DTOs) returned by the API and consumed by the frontends.
 * All money fields are integers in minor units.
 */
import type { ReturnDTO } from "./engagement";
import type {
  DiscountType,
  Fit,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  Role,
} from "./enums";

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

export interface AppliedCouponDTO {
  code: string;
  description: string | null;
  type: DiscountType;
  /** Discount on the current subtotal (0 for free-shipping coupons). */
  discount: number;
  /** False when the cart no longer qualifies (e.g. below the minimum order). */
  isValid: boolean;
  message: string | null;
}

export interface CartDTO {
  id: string | null;
  items: CartItemDTO[];
  itemCount: number;
  subtotal: number;
  coupon: AppliedCouponDTO | null;
  /** subtotal minus a valid coupon's discount (before shipping). */
  total: number;
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

// ───────────── Checkout ─────────────

export type ShippingMethodId = "standard" | "express";

export interface ShippingOptionDTO {
  id: ShippingMethodId;
  label: string;
  price: number;
  estimatedDays: string;
  isFree: boolean;
}

export interface PaymentOptionDTO {
  method: Extract<PaymentMethod, "STRIPE" | "COD">;
  label: string;
  /** Extra fee for this method (Cash on Delivery). */
  fee: number;
  available: boolean;
  /** True when card payments run in demo mode (no real money). */
  demo?: boolean;
}

export interface QuoteDTO {
  zone: string;
  shippingOptions: ShippingOptionDTO[];
  shippingMethod: ShippingMethodId;
  paymentOptions: PaymentOptionDTO[];
  paymentMethod: PaymentOptionDTO["method"];
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  tax: number;
  total: number;
  currency: string;
  coupon: AppliedCouponDTO | null;
  /** Spend this much more for free standard shipping (null if not applicable). */
  amountToFreeShipping: number | null;
}

export interface PaymentSessionDTO {
  provider: "stripe" | "demo";
  clientSecret: string;
  /** Stripe publishable key (null in demo mode). */
  publishableKey: string | null;
  amount: number;
  currency: string;
}

export interface CheckoutResultDTO {
  orderNumber: string;
  /** Secret for the order link: /orders/{number}?token=… */
  accessToken: string;
  status: OrderStatus;
  total: number;
  /** Present for card payments; null for Cash on Delivery. */
  payment: PaymentSessionDTO | null;
}

// ───────────── Orders ─────────────

export interface OrderItemDTO {
  id: string;
  title: string;
  slug: string;
  size: string;
  color: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderEventDTO {
  status: OrderStatus;
  note: string | null;
  at: string;
}

export interface OrderAddressDTO {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
}

export interface OrderDTO {
  number: string;
  status: OrderStatus;
  placedAt: string;
  email: string;
  phone: string;
  shippingAddress: OrderAddressDTO;
  items: OrderItemDTO[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  codFee: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  couponCode: string | null;
  shippingMethod: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | null;
  trackingNumber: string | null;
  courier: string | null;
  customerNote: string | null;
  timeline: OrderEventDTO[];
  /** Unpaid card order: payment can still be completed until this time. */
  payBy: string | null;
  canCancel: boolean;
  canPay: boolean;
  /** Return requests for this order, newest first. */
  returns: ReturnDTO[];
  /** True while a return can be requested (delivered, within the return window, items left). */
  canReturn: boolean;
  /** Last day to request a return (ISO), or null once that no longer applies. */
  returnBy: string | null;
}

export interface OrderListItemDTO {
  number: string;
  status: OrderStatus;
  placedAt: string;
  grandTotal: number;
  itemCount: number;
  imageUrl: string | null;
}

/** Limited view for "track my order" (no address or contact details). */
export interface OrderTrackingDTO {
  number: string;
  status: OrderStatus;
  placedAt: string;
  shippingMethod: string;
  city: string;
  trackingNumber: string | null;
  courier: string | null;
  items: Pick<OrderItemDTO, "title" | "size" | "color" | "quantity">[];
  timeline: OrderEventDTO[];
}
