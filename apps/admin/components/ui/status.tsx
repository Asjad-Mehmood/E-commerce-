import type { BadgeProps } from "@hoodie/ui";
import { Badge } from "@hoodie/ui";
import type {
  CouponDTO,
  MessageStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
} from "@hoodie/types";
import { ORDER_STATUS_LABEL } from "@hoodie/types";

type Tone = NonNullable<BadgeProps["tone"]>;

const ORDER_TONE: Record<OrderStatus, Tone> = {
  PENDING_PAYMENT: "warning",
  CONFIRMED: "brand",
  PAID: "brand",
  PROCESSING: "brand",
  SHIPPED: "neutral",
  DELIVERED: "success",
  CANCELLED: "danger",
  RETURN_REQUESTED: "warning",
  RETURNED: "neutral",
  REFUNDED: "danger",
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>
);

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  SUCCEEDED: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
};
const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  PENDING: "warning",
  SUCCEEDED: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "neutral",
};

export const PaymentStatusBadge = ({ status }: { status: PaymentStatus | null }) =>
  status ? <Badge tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge> : null;

const PRODUCT_TONE: Record<ProductStatus, Tone> = {
  ACTIVE: "success",
  DRAFT: "warning",
  ARCHIVED: "neutral",
};
const PRODUCT_LABEL: Record<ProductStatus, string> = {
  ACTIVE: "Active",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};
export const ProductStatusBadge = ({ status }: { status: ProductStatus }) => (
  <Badge tone={PRODUCT_TONE[status]}>{PRODUCT_LABEL[status]}</Badge>
);

const COUPON: Record<CouponDTO["state"], [string, Tone]> = {
  active: ["Active", "success"],
  scheduled: ["Scheduled", "brand"],
  expired: ["Expired", "neutral"],
  used_up: ["Used up", "neutral"],
  disabled: ["Disabled", "neutral"],
};
export const CouponStateBadge = ({ state }: { state: CouponDTO["state"] }) => (
  <Badge tone={COUPON[state][1]}>{COUPON[state][0]}</Badge>
);

const MESSAGE: Record<MessageStatus, [string, Tone]> = {
  NEW: ["New", "brand"],
  READ: ["Read", "neutral"],
  REPLIED: ["Replied", "success"],
  ARCHIVED: ["Archived", "neutral"],
};
export const MessageStatusBadge = ({ status }: { status: MessageStatus }) => (
  <Badge tone={MESSAGE[status][1]}>{MESSAGE[status][0]}</Badge>
);

/** Stock level with colour: out (red), low (amber), fine (plain). */
export function StockBadge({ available, lowStockAt }: { available: number; lowStockAt: number }) {
  if (available <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (available <= lowStockAt) return <Badge tone="warning">Low · {available}</Badge>;
  return <span className="tabular-nums">{available}</span>;
}
