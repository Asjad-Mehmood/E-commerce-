import type { OrderAddressDTO, OrderDTO, OrderListItemDTO, OrderTrackingDTO } from "@hoodie/types";
import type { Prisma } from "@prisma/client";
import { SHIPPING_LABEL } from "../checkout/pricing";

export const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: "desc" } },
  history: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** Customers may cancel until the order is being prepared (and before a card payment is taken). */
export const CUSTOMER_CANCELLABLE = ["PENDING_PAYMENT", "CONFIRMED"] as const;

export const shippingLabel = (method: string) =>
  SHIPPING_LABEL[method as keyof typeof SHIPPING_LABEL] ?? method;

const timeline = (o: FullOrder) =>
  o.history.map((h) => ({ status: h.status, note: h.note, at: h.createdAt.toISOString() }));

export function canPay(
  o: Pick<FullOrder, "status" | "paymentMethod" | "reservedUntil">,
  now = new Date(),
) {
  return (
    o.status === "PENDING_PAYMENT" &&
    o.paymentMethod === "STRIPE" &&
    !!o.reservedUntil &&
    o.reservedUntil > now
  );
}

export function toOrderDTO(o: FullOrder): OrderDTO {
  return {
    number: o.orderNumber,
    status: o.status,
    placedAt: o.placedAt.toISOString(),
    email: o.email,
    phone: o.phone,
    shippingAddress: o.shippingAddress as unknown as OrderAddressDTO,
    items: o.items.map((i) => ({
      title: i.productTitle,
      slug: i.productSlug,
      size: i.size,
      color: i.color,
      sku: i.sku,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    discountTotal: o.discountTotal,
    shippingTotal: o.shippingTotal,
    codFee: o.codFee,
    taxTotal: o.taxTotal,
    grandTotal: o.grandTotal,
    currency: o.currency,
    couponCode: o.couponCode,
    shippingMethod: shippingLabel(o.shippingMethod),
    paymentMethod: o.paymentMethod,
    paymentStatus: o.payments[0]?.status ?? null,
    trackingNumber: o.trackingNumber,
    courier: o.courier,
    customerNote: o.customerNote,
    timeline: timeline(o),
    payBy: canPay(o) ? o.reservedUntil!.toISOString() : null,
    canCancel: (CUSTOMER_CANCELLABLE as readonly string[]).includes(o.status),
    canPay: canPay(o),
  };
}

export function toOrderListItem(
  o: Prisma.OrderGetPayload<{ include: { items: true } }>,
): OrderListItemDTO {
  return {
    number: o.orderNumber,
    status: o.status,
    placedAt: o.placedAt.toISOString(),
    grandTotal: o.grandTotal,
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    imageUrl: o.items[0]?.imageUrl ?? null,
  };
}

export function toTracking(o: FullOrder): OrderTrackingDTO {
  return {
    number: o.orderNumber,
    status: o.status,
    placedAt: o.placedAt.toISOString(),
    shippingMethod: shippingLabel(o.shippingMethod),
    city: (o.shippingAddress as unknown as OrderAddressDTO).city,
    trackingNumber: o.trackingNumber,
    courier: o.courier,
    items: o.items.map((i) => ({
      title: i.productTitle,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
    })),
    timeline: timeline(o),
  };
}
