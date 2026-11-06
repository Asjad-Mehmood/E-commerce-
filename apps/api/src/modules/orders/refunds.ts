import { ErrorCode, formatMoney, type OrderStatus } from "@hoodie/types";
import type { RefundOrderInput } from "@hoodie/validation";
import { logger } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { getPaymentProvider } from "../payments";
import { capturedPayment, findOrderByNumber, UNSHIPPED_SALE } from "./admin-orders.service";
import { addSold } from "./lifecycle";
import { refundEmail } from "./order.emails";
import { orderInclude } from "./order.mapper";
import * as stock from "./stock";

/** Statuses in which the order's units were taken out of stock as a sale. */
const STOCK_TAKEN: OrderStatus[] = [
  ...UNSHIPPED_SALE,
  "SHIPPED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURNED",
];

/**
 * Refunds part or all of what the customer paid.
 *
 * Card payments are refunded through the payment provider (Stripe, or the demo
 * provider). Cash on Delivery refunds are recorded only: staff return the cash
 * themselves. The refund is claimed in the database first (so two staff members
 * cannot refund the same money twice) and rolled back if the provider refuses.
 *
 * A full refund marks the order REFUNDED. If the items never left the shop
 * (paid / confirmed / being prepared) they go back into stock by default,
 * which makes a full refund the way to cancel a paid card order.
 */
export async function refundOrder(number: string, input: RefundOrderInput, adminId: string) {
  const order = await findOrderByNumber(number);
  const payment = capturedPayment(order);
  if (!payment) {
    throw AppError.conflict(
      order.paymentMethod === "COD"
        ? "No cash has been collected for this order yet. Cancel it instead."
        : "No payment has been taken for this order.",
    );
  }
  if (order.status === "REFUNDED") throw AppError.conflict("This order is already refunded");

  const refundable = payment.amount - payment.refundedAmount;
  const amount = input.amount ?? refundable;
  if (amount > refundable) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `You can refund at most ${formatMoney(refundable)}`,
      {
        fieldErrors: { amount: [`You can refund at most ${formatMoney(refundable)}`] },
      },
    );
  }
  const full = amount === refundable;
  if (input.restock && !full) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Items can only be restocked with a full refund",
      {
        fieldErrors: { restock: ["Items can only be restocked with a full refund"] },
      },
    );
  }
  const canRestock = full && STOCK_TAKEN.includes(order.status);
  if (input.restock && !canRestock) {
    throw AppError.conflict(
      "These items were never taken out of stock, so there is nothing to restock",
    );
  }
  const restock = canRestock && (input.restock ?? UNSHIPPED_SALE.includes(order.status));

  const manual = payment.method === "COD";
  const provider = manual ? null : getPaymentProvider();
  if (!manual && (!provider || !payment.providerRef)) {
    throw new AppError(
      ErrorCode.SERVICE_UNAVAILABLE,
      "Card refunds are unavailable: no payment provider is configured",
      undefined,
      503,
    );
  }

  // 1. Claim the amount. The refundedAmount check makes concurrent refunds safe.
  const refund = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: payment.id, refundedAmount: payment.refundedAmount },
      data: {
        refundedAmount: { increment: amount },
        status: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });
    if (count === 0) {
      throw AppError.conflict("This payment was changed by someone else. Please reload.");
    }
    return tx.refund.create({
      data: {
        orderId: order.id,
        paymentId: payment.id,
        amount,
        reason: input.reason,
        createdBy: adminId,
      },
    });
  });

  // 2. Move the money (card only).
  let providerRef: string | null = null;
  if (provider) {
    try {
      ({ id: providerRef } = await provider.refund({
        intentId: payment.providerRef!,
        amount,
        idempotencyKey: `refund-${refund.id}`,
        reason: input.reason,
      }));
    } catch (err) {
      await prisma.$transaction([
        prisma.refund.delete({ where: { id: refund.id } }),
        prisma.payment.update({
          where: { id: payment.id },
          data: { refundedAmount: { decrement: amount }, status: payment.status },
        }),
      ]);
      logger.error({ err, order: order.orderNumber }, "Refund failed at the payment provider");
      const reason = err instanceof Error ? err.message : "unknown error";
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        `The payment provider refused the refund: ${reason}`,
        undefined,
        502,
      );
    }
  }

  // 3. Record the outcome on the order.
  await prisma.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: refund.id }, data: { providerRef, restocked: restock } });
    const note = `${full ? "Refunded" : "Partially refunded"} ${formatMoney(amount)}${manual ? " (cash, recorded by staff)" : ""}: ${input.reason}`;
    if (full) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "REFUNDED",
          history: { create: { status: "REFUNDED", note, changedBy: adminId } },
        },
      });
    } else {
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: order.status, note, changedBy: adminId },
      });
    }
    if (restock) {
      for (const item of order.items) {
        if (item.variantId) await stock.restock(tx, item.variantId, item.quantity);
      }
      await addSold(tx, order.items, -1);
      if (order.couponId) {
        await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE id = ${order.couponId}`;
      }
    }
  });

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: orderInclude,
  });
  void sendMail(refundEmail(updated, amount, manual));
  return { refundId: refund.id, amount, full, restocked: restock, providerRef };
}
