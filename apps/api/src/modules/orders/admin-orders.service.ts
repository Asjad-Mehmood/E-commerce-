import type {
  AdminOrderDTO,
  AdminOrderListItemDTO,
  OrderAddressDTO,
  OrderStatus,
} from "@hoodie/types";
import type { AdminOrderListQuery, UpdateAdminOrderInput } from "@hoodie/validation";
import type { Prisma } from "@prisma/client";
import { dayRange } from "../../lib/dates";
import { paginated, skipTake } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { storeTimeZone } from "../../lib/settings";
import { AppError } from "../../utils/app-error";
import { returnWindowDays } from "../returns/returns.shared";
import { CANCELLABLE, NEXT } from "./lifecycle";
import { orderInclude, toOrderDTO } from "./order.mapper";

/** Statuses where the items have left (or are about to leave) the shelf as a sale. */
export const UNSHIPPED_SALE: OrderStatus[] = ["CONFIRMED", "PAID", "PROCESSING"];

const listInclude = {
  items: { select: { quantity: true } },
  payments: { orderBy: { createdAt: "desc" }, select: { status: true, refundedAmount: true } },
} satisfies Prisma.OrderInclude;

type ListOrder = Prisma.OrderGetPayload<{ include: typeof listInclude }>;

export function toAdminListItem(o: ListOrder): AdminOrderListItemDTO {
  const address = o.shippingAddress as unknown as OrderAddressDTO;
  return {
    id: o.id,
    number: o.orderNumber,
    placedAt: o.placedAt.toISOString(),
    status: o.status,
    customerName: address.fullName,
    email: o.email,
    phone: o.phone,
    city: address.city,
    userId: o.userId,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.payments[0]?.status ?? null,
    grandTotal: o.grandTotal,
    refundedTotal: o.payments.reduce((n, p) => n + p.refundedAmount, 0),
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
  };
}

export const adminListInclude = listInclude;

const SORT: Record<AdminOrderListQuery["sort"], Prisma.OrderOrderByWithRelationInput> = {
  newest: { placedAt: "desc" },
  oldest: { placedAt: "asc" },
  total_desc: { grandTotal: "desc" },
  total_asc: { grandTotal: "asc" },
};

export async function orderWhere(q: Omit<AdminOrderListQuery, "page" | "limit" | "sort">) {
  const and: Prisma.OrderWhereInput[] = [];
  if (q.q) {
    const term = q.q.trim();
    and.push({
      OR: [
        { orderNumber: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term.replace(/[\s-]/g, "") } },
        { shippingAddress: { path: ["fullName"], string_contains: term } },
      ],
    });
  }
  if (q.status?.length) and.push({ status: { in: q.status } });
  if (q.paymentMethod) and.push({ paymentMethod: q.paymentMethod });
  if (q.from || q.to) {
    const zone = await storeTimeZone();
    const range = dayRange(zone, q.from, q.to, 3650);
    and.push({ placedAt: { gte: range.start, lt: range.end } });
  }
  return { AND: and } satisfies Prisma.OrderWhereInput;
}

export async function listOrders(q: AdminOrderListQuery) {
  const where = await orderWhere(q);
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: listInclude,
      orderBy: [SORT[q.sort], { id: "desc" }],
      ...skipTake(q),
    }),
    prisma.order.count({ where }),
  ]);
  return paginated(rows.map(toAdminListItem), { page: q.page, limit: q.limit, total });
}

/** Up to 10,000 orders with their items, for the CSV export. */
export async function ordersForExport(q: AdminOrderListQuery) {
  return prisma.order.findMany({
    where: await orderWhere(q),
    include: { ...listInclude, items: true },
    orderBy: [SORT[q.sort], { id: "desc" }],
    take: 10_000,
  });
}

const detailInclude = {
  ...orderInclude,
  refunds: { orderBy: { createdAt: "asc" } },
  user: {
    select: { id: true, name: true, email: true, _count: { select: { orders: true } } },
  },
} satisfies Prisma.OrderInclude;

export type AdminFullOrder = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

export async function findOrderByNumber(number: string): Promise<AdminFullOrder> {
  const order = await prisma.order.findUnique({
    where: { orderNumber: number.toUpperCase() },
    include: detailInclude,
  });
  if (!order) throw AppError.notFound("Order");
  return order;
}

/** The payment money was actually taken on (card captured, or COD collected). */
export const capturedPayment = (o: Pick<AdminFullOrder, "payments">) =>
  o.payments.find((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED");

export function orderActions(o: AdminFullOrder): AdminOrderDTO["actions"] {
  const paid = capturedPayment(o);
  const refundable = paid ? paid.amount - paid.refundedAmount : 0;
  return {
    nextStatuses: NEXT[o.status] ?? [],
    canCancel:
      CANCELLABLE.includes(o.status) &&
      !(o.paymentMethod === "STRIPE" && o.status !== "PENDING_PAYMENT"),
    canRefund: refundable > 0 && o.status !== "REFUNDED",
    refundable,
    restockByDefault: UNSHIPPED_SALE.includes(o.status),
    refundMode: paid ? (paid.method === "COD" ? "manual" : "card") : null,
  };
}

async function staffNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function toAdminOrderDTO(o: AdminFullOrder): Promise<AdminOrderDTO> {
  const names = await staffNames([
    ...o.history.map((h) => h.changedBy),
    ...o.refunds.map((r) => r.createdBy),
  ]);
  const base = toOrderDTO(o, await returnWindowDays());
  return {
    ...base,
    id: o.id,
    userId: o.userId,
    customer: o.user
      ? {
          id: o.user.id,
          name: o.user.name,
          email: o.user.email,
          orderCount: o.user._count.orders,
        }
      : null,
    adminNotes: o.adminNotes,
    timeline: o.history.map((h) => ({
      status: h.status,
      note: h.note,
      at: h.createdAt.toISOString(),
      by: h.changedBy ? (names.get(h.changedBy) ?? "Staff") : null,
    })),
    payments: o.payments.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      amount: p.amount,
      refundedAmount: p.refundedAmount,
      providerRef: p.providerRef,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
    })),
    refunds: o.refunds.map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      providerRef: r.providerRef,
      restocked: r.restocked,
      by: r.createdBy ? (names.get(r.createdBy) ?? "Staff") : null,
      createdAt: r.createdAt.toISOString(),
    })),
    refundedTotal: o.payments.reduce((n, p) => n + p.refundedAmount, 0),
    actions: orderActions(o),
  };
}

export async function getAdminOrder(number: string) {
  return toAdminOrderDTO(await findOrderByNumber(number));
}

export async function updateAdminOrder(number: string, input: UpdateAdminOrderInput) {
  const order = await findOrderByNumber(number);
  await prisma.order.update({ where: { id: order.id }, data: input });
  return getAdminOrder(number);
}
