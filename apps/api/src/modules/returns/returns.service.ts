import type { AdminReturnDTO, AdminReturnListItemDTO, OrderAddressDTO } from "@hoodie/types";
import { ErrorCode, formatMoney, RETURN_REASON_LABEL } from "@hoodie/types";
import type { ReturnRequestInput } from "@hoodie/validation";
import type { Prisma, ReturnStatus } from "@prisma/client";
import { paginated, skipTake } from "../../lib/http";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { storeInfo } from "../../lib/settings";
import { AppError } from "../../utils/app-error";
import { afterStockIncrease } from "../engagement/stock-alerts";
import { capturedPayment } from "../orders/admin-orders.service";
import { addSold } from "../orders/lifecycle";
import { refundOrder } from "../orders/refunds";
import * as stock from "../orders/stock";
import {
  returnApprovedEmail,
  returnReceivedEmail,
  returnRejectedEmail,
  returnRequestedEmail,
} from "./returns.emails";
import {
  linesOf,
  returnableQuantities,
  returnWindow,
  returnWindowDays,
  toReturnDTO,
} from "./returns.shared";

export { returnWindowDays };

// ───────────── Customer ─────────────

/**
 * A customer asks to return items from a delivered order, within the return
 * window. The order moves to RETURN_REQUESTED and staff decide what happens.
 */
export async function requestReturn(orderId: string, input: ReturnRequestInput) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, returns: true },
  });
  const window = returnWindow(order, await returnWindowDays());
  if (!window.canReturn) {
    throw AppError.conflict(
      order.status !== "DELIVERED" && order.status !== "RETURNED"
        ? "Returns can be requested once an order has been delivered"
        : order.returns.some((r) => ["REQUESTED", "APPROVED", "RECEIVED"].includes(r.status))
          ? "There is already a return in progress for this order"
          : "The return window for this order has closed",
    );
  }

  const left = returnableQuantities(order.items, order.returns);
  for (const line of input.items) {
    const max = left.get(line.orderItemId);
    if (max === undefined) throw AppError.badRequest("That item is not part of this order");
    if (line.quantity > max) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `You can return at most ${max} of that item`, {
        fieldErrors: { items: [`You can return at most ${max} of that item`] },
      });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    // Claim the order so two requests can't both get through.
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: "RETURN_REQUESTED" },
    });
    if (!count) throw AppError.conflict("This order was just updated. Please reload.");
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: "RETURN_REQUESTED",
        note: `Return requested: ${RETURN_REASON_LABEL[input.reason] ?? input.reason}`,
      },
    });
    return tx.returnRequest.create({
      data: {
        orderId: order.id,
        reason: input.reason,
        details: input.details || null,
        items: input.items as unknown as Prisma.InputJsonValue,
      },
    });
  });

  const dto = toReturnDTO(created, order.items);
  void sendMail(returnRequestedEmail(order, dto));
  return dto;
}

// ───────────── Admin ─────────────

const adminInclude = {
  order: {
    include: { items: true, payments: { orderBy: { createdAt: "desc" } }, returns: true },
  },
} satisfies Prisma.ReturnRequestInclude;
type FullReturn = Prisma.ReturnRequestGetPayload<{ include: typeof adminInclude }>;

async function findReturn(id: string): Promise<FullReturn> {
  const r = await prisma.returnRequest.findUnique({ where: { id }, include: adminInclude });
  if (!r) throw AppError.notFound("Return");
  return r;
}

function toAdminReturn(r: FullReturn): AdminReturnDTO {
  const dto = toReturnDTO(r, r.order.items);
  const paid = capturedPayment(r.order);
  const refundable = paid ? paid.amount - paid.refundedAmount : 0;
  return {
    ...dto,
    restocked: r.restocked,
    order: {
      number: r.order.orderNumber,
      status: r.order.status,
      paymentMethod: r.order.paymentMethod,
      customerName: (r.order.shippingAddress as unknown as OrderAddressDTO).fullName,
      email: r.order.email,
      phone: r.order.phone,
      deliveredAt: r.order.deliveredAt?.toISOString() ?? null,
      refundable,
    },
    suggestedRefund: Math.min(dto.itemsValue, refundable),
  };
}

export async function listReturns(q: {
  page: number;
  limit: number;
  status?: ReturnStatus | "open";
}) {
  const where: Prisma.ReturnRequestWhereInput =
    q.status === "open"
      ? { status: { in: ["REQUESTED", "APPROVED", "RECEIVED"] } }
      : q.status
        ? { status: q.status }
        : {};
  const [rows, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      include: { order: { include: { items: true } } },
      orderBy: { createdAt: q.status === "REQUESTED" || q.status === "open" ? "asc" : "desc" },
      ...skipTake(q),
    }),
    prisma.returnRequest.count({ where }),
  ]);
  return paginated(
    rows.map((r): AdminReturnListItemDTO => {
      const dto = toReturnDTO(r, r.order.items);
      return {
        id: r.id,
        status: r.status,
        reason: r.reason,
        orderNumber: r.order.orderNumber,
        customerName: (r.order.shippingAddress as unknown as OrderAddressDTO).fullName,
        email: r.order.email,
        itemCount: dto.items.reduce((n, i) => n + i.quantity, 0),
        itemsValue: dto.itemsValue,
        createdAt: r.createdAt.toISOString(),
      };
    }),
    { page: q.page, limit: q.limit, total },
  );
}

export const getReturn = async (id: string) => toAdminReturn(await findReturn(id));

/** Moves a return from one of `from` to `to`, atomically. */
async function transition(
  tx: Prisma.TransactionClient,
  r: FullReturn,
  from: ReturnStatus[],
  data: Prisma.ReturnRequestUpdateManyMutationInput,
) {
  const { count } = await tx.returnRequest.updateMany({
    where: { id: r.id, status: { in: from } },
    data,
  });
  if (!count) {
    throw AppError.conflict(`This return is ${r.status.toLowerCase()}, so that can't be done now`);
  }
}

export async function approveReturn(id: string, note: string | undefined, adminId: string) {
  const r = await findReturn(id);
  await prisma.$transaction(async (tx) => {
    await transition(tx, r, ["REQUESTED"], { status: "APPROVED", adminNote: note || null });
    await tx.orderStatusHistory.create({
      data: {
        orderId: r.orderId,
        status: r.order.status,
        note: `Return approved${note ? `: ${note}` : ""}`,
        changedBy: adminId,
      },
    });
  });
  const updated = await findReturn(id);
  void sendMail(
    returnApprovedEmail(r.order, toReturnDTO(updated, r.order.items), await storeInfo()),
  );
  return toAdminReturn(updated);
}

export async function rejectReturn(id: string, note: string, adminId: string) {
  const r = await findReturn(id);
  // Back to where the order was before this request.
  const earlierReturned = r.order.returns.some(
    (x) => x.id !== r.id && (x.status === "RECEIVED" || x.status === "REFUNDED"),
  );
  const orderStatus = earlierReturned ? "RETURNED" : "DELIVERED";
  await prisma.$transaction(async (tx) => {
    await transition(tx, r, ["REQUESTED", "APPROVED"], { status: "REJECTED", adminNote: note });
    await tx.order.update({
      where: { id: r.orderId },
      data: {
        status: orderStatus,
        history: {
          create: { status: orderStatus, note: `Return declined: ${note}`, changedBy: adminId },
        },
      },
    });
  });
  const updated = await findReturn(id);
  void sendMail(returnRejectedEmail(r.order, toReturnDTO(updated, r.order.items)));
  return toAdminReturn(updated);
}

/** The parcel arrived. Optionally puts the items back on sale. */
export async function receiveReturn(
  id: string,
  input: { restock: boolean; note?: string },
  adminId: string,
) {
  const r = await findReturn(id);
  const lines = linesOf(r).flatMap((l) => {
    const item = r.order.items.find((i) => i.id === l.orderItemId);
    return item ? [{ variantId: item.variantId, quantity: l.quantity }] : [];
  });
  await prisma.$transaction(async (tx) => {
    await transition(tx, r, ["APPROVED", "REQUESTED"], {
      status: "RECEIVED",
      receivedAt: new Date(),
      restocked: input.restock,
      ...(input.note ? { adminNote: input.note } : {}),
    });
    if (input.restock) {
      for (const l of lines) if (l.variantId) await stock.restock(tx, l.variantId, l.quantity);
      await addSold(tx, lines, -1);
    }
    await tx.order.update({
      where: { id: r.orderId },
      data: {
        status: "RETURNED",
        history: {
          create: {
            status: "RETURNED",
            note: `Returned items received${input.restock ? " and restocked" : " (not restocked)"}${input.note ? `: ${input.note}` : ""}`,
            changedBy: adminId,
          },
        },
      },
    });
  });
  if (input.restock) await afterStockIncrease(lines.map((l) => l.variantId));
  const updated = await findReturn(id);
  void sendMail(returnReceivedEmail(r.order, toReturnDTO(updated, r.order.items)));
  return toAdminReturn(updated);
}

/**
 * Refunds a received return through the order's payment (card via the provider,
 * Cash on Delivery recorded for staff to pay back). Defaults to the value of
 * the returned items, capped at what is still refundable.
 */
export async function refundReturn(
  id: string,
  input: { amount?: number; note?: string },
  adminId: string,
) {
  const r = await findReturn(id);
  if (r.status !== "RECEIVED") {
    throw AppError.conflict("Refund a return once the items have been received");
  }
  const current = toAdminReturn(r);
  const amount = input.amount ?? current.suggestedRefund;
  if (amount <= 0) throw AppError.conflict("There is nothing left to refund on this order");

  const result = await refundOrder(
    r.order.orderNumber,
    {
      amount,
      reason: `Return ${r.order.orderNumber}${input.note ? `: ${input.note}` : ` (${formatMoney(amount)})`}`,
      restock: false,
    },
    adminId,
  );
  await prisma.returnRequest.update({
    where: { id },
    data: { status: "REFUNDED", refundAmount: result.amount, refundedAt: new Date() },
  });
  return { ...(await getReturn(id)), refund: result };
}
