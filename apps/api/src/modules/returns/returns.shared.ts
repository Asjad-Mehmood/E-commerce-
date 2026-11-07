import type { ReturnDTO } from "@hoodie/types";
import type { OrderItem, OrderStatus, ReturnRequest } from "@prisma/client";
import { getSetting } from "../../lib/settings";

/** Days after delivery a customer may ask for a return (store setting). */
export const returnWindowDays = () => getSetting("returns.windowDays", 14);

export interface ReturnLine {
  orderItemId: string;
  quantity: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Returns still being handled (they block a new request). */
export const OPEN_RETURN = ["REQUESTED", "APPROVED", "RECEIVED"] as const;

export const linesOf = (r: Pick<ReturnRequest, "items">) => r.items as unknown as ReturnLine[];

export function toReturnDTO(r: ReturnRequest, items: OrderItem[]): ReturnDTO {
  const lines = linesOf(r).flatMap((line) => {
    const item = items.find((i) => i.id === line.orderItemId);
    return item
      ? [
          {
            orderItemId: item.id,
            title: item.productTitle,
            size: item.size,
            color: item.color,
            sku: item.sku,
            imageUrl: item.imageUrl,
            unitPrice: item.unitPrice,
            quantity: line.quantity,
          },
        ]
      : [];
  });
  return {
    id: r.id,
    status: r.status,
    reason: r.reason,
    details: r.details,
    items: lines,
    itemsValue: lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0),
    refundAmount: r.refundAmount,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    receivedAt: r.receivedAt?.toISOString() ?? null,
    refundedAt: r.refundedAt?.toISOString() ?? null,
  };
}

/** Units of each order item that can still be returned (declined returns don't count). */
export function returnableQuantities(items: OrderItem[], returns: ReturnRequest[]) {
  const used = new Map<string, number>();
  for (const r of returns) {
    if (r.status === "REJECTED") continue;
    for (const l of linesOf(r))
      used.set(l.orderItemId, (used.get(l.orderItemId) ?? 0) + l.quantity);
  }
  return new Map(items.map((i) => [i.id, i.quantity - (used.get(i.id) ?? 0)]));
}

export interface ReturnWindowInput {
  status: OrderStatus;
  deliveredAt: Date | null;
  items: OrderItem[];
  returns: ReturnRequest[];
}

/** Whether a return can be requested now, and the last day to ask. */
export function returnWindow(o: ReturnWindowInput, windowDays: number, now = new Date()) {
  const deadline =
    o.deliveredAt && windowDays > 0 ? new Date(o.deliveredAt.getTime() + windowDays * DAY) : null;
  const inWindow = !!deadline && now <= deadline;
  const eligibleStatus = o.status === "DELIVERED" || o.status === "RETURNED";
  const open = o.returns.some((r) => (OPEN_RETURN as readonly string[]).includes(r.status));
  const left = [...returnableQuantities(o.items, o.returns).values()].some((n) => n > 0);
  return {
    canReturn: eligibleStatus && inWindow && !open && left,
    returnBy:
      inWindow && (eligibleStatus || o.status === "RETURN_REQUESTED")
        ? deadline!.toISOString()
        : null,
  };
}
