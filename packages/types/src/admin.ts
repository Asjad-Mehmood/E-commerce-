import type { AddressDTO, OrderDTO } from "./dto";
import type {
  AdminRole,
  DiscountType,
  MessageStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
} from "./enums";

/*
 * Admin (Phase 4) response shapes. Money is in minor units; dates are ISO strings.
 */

// ───────────── Orders ─────────────

export interface AdminOrderListItemDTO {
  id: string;
  number: string;
  placedAt: string;
  status: OrderStatus;
  customerName: string;
  email: string;
  phone: string;
  city: string;
  userId: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | null;
  grandTotal: number;
  refundedTotal: number;
  itemCount: number;
}

export interface AdminPaymentDTO {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  refundedAmount: number;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface AdminRefundDTO {
  id: string;
  amount: number;
  reason: string;
  /** Null for refunds recorded manually (Cash on Delivery). */
  providerRef: string | null;
  restocked: boolean;
  by: string | null;
  createdAt: string;
}

export interface AdminOrderEventDTO {
  status: OrderStatus;
  note: string | null;
  at: string;
  /** Staff member's name, or null for the customer / system. */
  by: string | null;
}

export interface AdminOrderActionsDTO {
  /** Fulfilment steps available from the current status. */
  nextStatuses: OrderStatus[];
  /** Cancel without a refund (unpaid card orders, Cash on Delivery before shipping). */
  canCancel: boolean;
  canRefund: boolean;
  /** Amount still refundable, in minor units. */
  refundable: number;
  /** Whether a full refund puts the items back in stock unless told otherwise. */
  restockByDefault: boolean;
  /** "card" refunds go through the payment provider; "manual" ones are recorded only. */
  refundMode: "card" | "manual" | null;
}

export interface AdminOrderDTO extends Omit<OrderDTO, "timeline"> {
  id: string;
  userId: string | null;
  customer: { id: string; name: string; email: string; orderCount: number } | null;
  adminNotes: string | null;
  timeline: AdminOrderEventDTO[];
  payments: AdminPaymentDTO[];
  refunds: AdminRefundDTO[];
  refundedTotal: number;
  actions: AdminOrderActionsDTO;
}

// ───────────── Dashboard ─────────────

export interface KpiDTO {
  value: number;
  /** Same-length period immediately before, for the trend arrow. */
  previous: number;
}

export interface DashboardDTO {
  range: { days: number; from: string; to: string };
  kpis: {
    sales: KpiDTO;
    orders: KpiDTO;
    averageOrderValue: KpiDTO;
    newCustomers: KpiDTO;
  };
  today: { sales: number; orders: number };
  /** Orders waiting for staff: paid / confirmed / being prepared. */
  toFulfil: number;
  awaitingPayment: number;
  series: { date: string; sales: number; orders: number }[];
  topProducts: {
    productId: string;
    title: string;
    image: string | null;
    units: number;
    revenue: number;
  }[];
  lowStock: InventoryRowDTO[];
  recentOrders: AdminOrderListItemDTO[];
  paymentMix: { method: PaymentMethod; orders: number; sales: number }[];
}

export interface AdminNotificationsDTO {
  toFulfil: number;
  newMessages: number;
  lowStock: number;
  /** Return requests waiting for a decision. */
  pendingReturns: number;
  /** Reviews waiting for moderation. */
  pendingReviews: number;
  latestOrder: { number: string; placedAt: string; grandTotal: number } | null;
}

// ───────────── Customers ─────────────

export interface AdminCustomerListItemDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  isBlocked: boolean;
  emailVerified: boolean;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AdminCustomerDTO extends AdminCustomerListItemDTO {
  adminNote: string | null;
  lastLoginAt: string | null;
  averageOrderValue: number;
  firstOrderAt: string | null;
  addresses: AddressDTO[];
  orders: AdminOrderListItemDTO[];
}

// ───────────── Inventory ─────────────

export interface InventoryRowDTO {
  variantId: string;
  productId: string;
  productTitle: string;
  productStatus: ProductStatus;
  image: string | null;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number;
  stock: number;
  reserved: number;
  available: number;
  lowStockAt: number;
  isActive: boolean;
  /** Shoppers waiting for a back-in-stock email. */
  waiting: number;
}

export interface StockAdjustmentDTO {
  id: string;
  change: number;
  reason: string;
  note: string | null;
  by: string | null;
  createdAt: string;
}

// ───────────── Marketing & content ─────────────

export interface CouponDTO {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  value: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  /** active | scheduled | expired | used_up | disabled */
  state: "active" | "scheduled" | "expired" | "used_up" | "disabled";
  createdAt: string;
}

export interface ShippingZoneDTO {
  id: string;
  name: string;
  regions: string[];
  standardRate: number;
  expressRate: number | null;
  freeOverAmount: number | null;
  codFee: number;
  codEnabled: boolean;
  estimatedDays: string;
  position: number;
  isActive: boolean;
}

export interface AdminBannerDTO {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string | null;
  ctaLabel: string | null;
  position: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface AdminPageDTO {
  id: string;
  slug: string;
  title: string;
  content: string;
  seoDescription: string | null;
  isPublished: boolean;
  updatedAt: string;
}

export interface AdminFaqDTO {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  position: number;
  isActive: boolean;
}

export interface AnnouncementDTO {
  enabled: boolean;
  text: string;
}

export interface ContactMessageDTO {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: MessageStatus;
  createdAt: string;
}

// ───────────── Reports ─────────────

export interface SalesReportRowDTO {
  /** Start of the period (YYYY-MM-DD, store time zone). */
  period: string;
  orders: number;
  units: number;
  /** Order totals (after discounts, including shipping and fees). */
  gross: number;
  discounts: number;
  shipping: number;
  refunds: number;
  /** gross - refunds */
  net: number;
}

export interface SalesReportDTO {
  from: string;
  to: string;
  groupBy: "day" | "week" | "month";
  rows: SalesReportRowDTO[];
  totals: Omit<SalesReportRowDTO, "period">;
}

export interface ProductReportRowDTO {
  productId: string;
  title: string;
  orders: number;
  units: number;
  revenue: number;
}

export interface CategoryReportRowDTO {
  categoryId: string | null;
  name: string;
  units: number;
  revenue: number;
}

export interface InventoryValuationRowDTO {
  productId: string;
  title: string;
  status: ProductStatus;
  units: number;
  /** Units × selling price (no cost prices are stored yet). */
  retailValue: number;
}

// ───────────── Staff, settings, audit ─────────────

export interface StaffMemberDTO {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isBlocked: boolean;
  /** True until the invited person sets a password. */
  invitePending: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Set when email isn't configured: the set-password link to pass on by hand. */
  inviteLink?: string;
}

export interface StoreSettingsDTO {
  "store.name": string;
  "store.email": string;
  "store.phone": string;
  "store.address": string;
  "tax.rate": number;
  "tax.inclusive": boolean;
  "payments.card.enabled": boolean;
  "payments.cod.enabled": boolean;
  "returns.windowDays": number;
  "reviews.autoApprove": boolean;
  "notifications.dailyDigest": boolean;
}

export interface StoreSettingsResponseDTO {
  settings: StoreSettingsDTO;
  /** Read-only facts about how the store is configured. */
  system: {
    currency: string;
    timeZone: string;
    /** "stripe" (keys set), "demo" (test cards only) or null (card payments unavailable). */
    paymentProvider: "stripe" | "demo" | null;
    /** How email is sent, or null while it isn't set up (nothing is sent). */
    emailProvider: "smtp" | "resend" | null;
    uploads: "cloudinary" | "database";
  };
}

export interface AuditLogEntryDTO {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  diff: unknown;
  ip: string | null;
  createdAt: string;
  admin: { id: string; name: string; email: string } | null;
}

export interface UploadConfigDTO {
  /** Cloudinary when its keys are set; otherwise images are stored in the database. */
  provider: "cloudinary" | "database";
  /** Largest accepted file, in bytes. */
  maxBytes: number;
}

export interface EmailSettingsDTO {
  provider: "none" | "smtp" | "resend";
  from: string;
  smtp: { host: string; port: number; secure: boolean; user: string; hasPassword: boolean };
  hasResendKey: boolean;
  /** True when emails are actually being sent. */
  configured: boolean;
  /** "environment" when only RESEND_API_KEY on the server is configuring email. */
  source: "settings" | "environment" | null;
}
