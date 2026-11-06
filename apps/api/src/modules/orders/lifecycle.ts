import { ErrorCode, type OrderStatus } from "@hoodie/types";
import type { UpdateOrderStatusInput } from "@hoodie/validation";
import type { Prisma } from "@prisma/client";
import { logger } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { getPaymentProvider, type PaymentEvent } from "../payments";
import { cancelledEmail, confirmationEmail, deliveredEmail, shippedEmail } from "./order.emails";
import { orderInclude, type FullOrder } from "./order.mapper";
import * as stock from "./stock";

type Tx = Prisma.TransactionClient;

const loadOrder = (id: string) =>
  prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });

/** Removes the ordered variants (and the coupon) from the cart the order came from. */
async function clearOrderedFromCart(
  tx: Tx,
  order: { cartId: string | null; items: { variantId: string | null }[] },
) {
  if (!order.cartId) return;
  const variantIds = order.items.map((i) => i.variantId).filter((v): v is string => !!v);
  await tx.cartItem.deleteMany({ where: { cartId: order.cartId, variantId: { in: variantIds } } });
  await tx.cart.updateMany({ where: { id: order.cartId }, data: { couponId: null } });
}

async function addSold(
  tx: Tx,
  items: { variantId: string | null; quantity: number }[],
  sign: 1 | -1,
) {
  for (const item of items) {
    if (!item.variantId) continue;
    const variant = await tx.productVariant.findUnique({
      where: { id: item.variantId },
      select: { productId: true },
    });
    if (variant) {
      await tx.product.update({
        where: { id: variant.productId },
        data: { soldCount: { increment: sign * item.quantity } },
      });
    }
  }
}

export { addSold, clearOrderedFromCart };

// ───────────── Payment events ─────────────

/**
 * Applies a payment provider event (Stripe webhook or demo charge) exactly once.
 * Success turns the stock reservation into a sale and confirms the order.
 */
export async function applyPaymentEvent(
  event: PaymentEvent,
  provider: string,
): Promise<"applied" | "duplicate" | "ignored"> {
  try {
    await prisma.processedPaymentEvent.create({
      data: { id: event.id, provider, type: event.type },
    });
  } catch {
    return "duplicate";
  }

  const payment = await prisma.payment.findUnique({ where: { providerRef: event.intentId } });
  if (!payment) {
    logger.warn({ event }, "Payment event for an unknown intent");
    return "ignored";
  }
  if (event.type === "failed")
    await markPaymentFailed(payment.id, event.failureReason ?? "Payment failed");
  else await markPaid(payment.id);
  return "applied";
}

export async function markPaid(paymentId: string): Promise<void> {
  const result = await prisma
    .$transaction(async (tx) => {
      // Claim the payment so concurrent deliveries cannot apply it twice.
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "SUCCEEDED", failureReason: null },
      });
      if (claimed.count === 0) return null;

      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { items: true },
      });

      if (order.status === "PENDING_PAYMENT") {
        for (const item of order.items) {
          if (item.variantId && !(await stock.sellReserved(tx, item.variantId, item.quantity))) {
            // Should not happen (the units were reserved), but never fail a captured payment.
            await stock.sell(tx, item.variantId, item.quantity);
          }
        }
      } else if (order.status === "CANCELLED") {
        // Paid after the reservation expired: take the units again if they are still available.
        for (const item of order.items) {
          if (item.variantId && !(await stock.sell(tx, item.variantId, item.quantity))) {
            throw new AppError(ErrorCode.OUT_OF_STOCK, "late-payment-out-of-stock");
          }
        }
      } else {
        return null; // already paid / processed
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          reservedUntil: null,
          cancelledAt: null,
          history: {
            create: {
              status: "PAID",
              note:
                order.status === "CANCELLED"
                  ? "Payment received after the order had expired"
                  : "Payment received",
            },
          },
        },
      });
      await addSold(tx, order.items, 1);
      await clearOrderedFromCart(tx, order);
      return order.id;
    })
    .catch(async (err) => {
      if (err instanceof AppError && err.message === "late-payment-out-of-stock") {
        // Money was taken but the items are gone: flag for a refund (admin, Phase 4).
        const payment = await prisma.payment.update({
          where: { id: paymentId },
          data: { status: "SUCCEEDED" },
        });
        await prisma.order.update({
          where: { id: payment.orderId },
          data: {
            adminNotes:
              "Paid after the reservation expired, but stock was no longer available. Refund required.",
            history: {
              create: {
                status: "CANCELLED",
                note: "Payment received too late; items no longer available. A refund will be issued.",
              },
            },
          },
        });
        logger.error(
          { paymentId },
          "Late payment for a cancelled order with no stock: refund required",
        );
        return null;
      }
      throw err;
    });

  if (result) void sendMail(confirmationEmail(await loadOrder(result)));
}

/**
 * Records a declined card. The payment stays PENDING and the order stays open,
 * so the customer can retry with another card until the reservation expires.
 */
export async function markPaymentFailed(paymentId: string, reason: string): Promise<void> {
  const { count } = await prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { failureReason: reason },
  });
  if (count === 0) return;
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await prisma.orderStatusHistory.create({
    data: {
      orderId: payment.orderId,
      status: "PENDING_PAYMENT",
      note: `Payment failed: ${reason}`,
    },
  });
}

// ───────────── Cancellation ─────────────

export const CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED", "PROCESSING"];

/**
 * Cancels an order and returns its stock: reserved units for unpaid card
 * orders, sold units for Cash on Delivery orders. Paid card orders need a
 * refund and are handled by the admin refund flow (Phase 4).
 */
export async function cancelOrder(
  orderId: string,
  opts: { reason: string; changedBy?: string | null; allowed?: OrderStatus[]; notify?: boolean },
): Promise<FullOrder> {
  const allowed = opts.allowed ?? CANCELLABLE;
  const cancelled = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw AppError.notFound("Order");
    if (order.paymentMethod === "STRIPE" && order.status !== "PENDING_PAYMENT") {
      throw AppError.conflict("Paid card orders are cancelled with a refund from the admin panel");
    }

    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: { in: allowed } },
      data: { status: "CANCELLED", cancelledAt: new Date(), reservedUntil: null },
    });
    if (count === 0) throw AppError.conflict("This order can no longer be cancelled");

    for (const item of order.items) {
      if (!item.variantId) continue;
      if (order.status === "PENDING_PAYMENT")
        await stock.release(tx, item.variantId, item.quantity);
      else await stock.restock(tx, item.variantId, item.quantity);
    }
    if (order.status !== "PENDING_PAYMENT") await addSold(tx, order.items, -1);
    if (order.couponId) {
      await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE id = ${order.couponId}`;
    }
    await tx.payment.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "FAILED", failureReason: "Order cancelled" },
    });
    await tx.orderStatusHistory.create({
      data: { orderId, status: "CANCELLED", note: opts.reason, changedBy: opts.changedBy ?? null },
    });
    return order;
  });

  const provider = getPaymentProvider();
  if (cancelled.paymentMethod === "STRIPE" && provider) {
    const pending = await prisma.payment.findMany({
      where: { orderId, providerRef: { not: null } },
    });
    for (const p of pending) await provider.cancelIntent(p.providerRef!);
  }

  const order = await loadOrder(orderId);
  if (opts.notify !== false) void sendMail(cancelledEmail(order, opts.reason));
  return order;
}

/** Cancels unpaid card orders whose reservation has run out. Safe to run on several servers. */
export async function expireUnpaidOrders(now = new Date()): Promise<number> {
  const due = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", reservedUntil: { lt: now } },
    select: { id: true },
    take: 100,
  });
  let expired = 0;
  for (const { id } of due) {
    try {
      await cancelOrder(id, {
        reason: "Payment was not completed in time.",
        allowed: ["PENDING_PAYMENT"],
        notify: false,
      });
      expired++;
    } catch (err) {
      // Another server got there first, or the payment just succeeded.
      if (!(err instanceof AppError)) logger.error({ err, orderId: id }, "Failed to expire order");
    }
  }
  return expired;
}

// ───────────── Fulfilment (admin) ─────────────

/** Allowed fulfilment steps. Cancellation goes through cancelOrder. */
export const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CONFIRMED: ["PROCESSING"],
  PAID: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
};

export async function updateOrderStatus(
  orderId: string,
  input: UpdateOrderStatusInput,
  changedBy: string,
): Promise<FullOrder> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound("Order");

  if (input.status === "CANCELLED") {
    return cancelOrder(orderId, { reason: input.note ?? "Cancelled by the store.", changedBy });
  }
  if (!NEXT[order.status]?.includes(input.status)) {
    throw AppError.conflict(`An order that is ${order.status} cannot move to ${input.status}`, {
      allowed: [
        ...(NEXT[order.status] ?? []),
        ...(CANCELLABLE.includes(order.status) ? ["CANCELLED"] : []),
      ],
    });
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: input.status,
        ...(input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
        ...(input.courier ? { courier: input.courier } : {}),
      },
    });
    if (count === 0)
      throw AppError.conflict("The order was changed by someone else. Please reload.");
    await tx.orderStatusHistory.create({
      data: { orderId, status: input.status, note: input.note ?? null, changedBy },
    });
    // Cash on Delivery: the money is collected on delivery.
    if (input.status === "DELIVERED" && order.paymentMethod === "COD") {
      await tx.payment.updateMany({
        where: { orderId, status: "PENDING" },
        data: { status: "SUCCEEDED" },
      });
    }
  });

  const updated = await loadOrder(orderId);
  if (input.status === "SHIPPED") void sendMail(shippedEmail(updated));
  if (input.status === "DELIVERED") void sendMail(deliveredEmail(updated));
  return updated;
}
