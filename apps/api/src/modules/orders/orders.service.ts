import type { OrderDTO, PaymentSessionDTO } from "@hoodie/types";
import type { ReturnRequestInput } from "@hoodie/validation";
import { paginated, skipTake } from "../../lib/http";
import { requestReturn, returnWindowDays } from "../returns/returns.service";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { getPaymentProvider } from "../payments";
import { cancelOrder } from "./lifecycle";
import { isValidOrderToken } from "./order-access";
import {
  CUSTOMER_CANCELLABLE,
  canPay,
  orderInclude,
  toOrderDTO,
  toOrderListItem,
  toTracking,
  type FullOrder,
} from "./order.mapper";

export interface Viewer {
  userId?: string;
  token?: string;
}

/**
 * Finds an order the viewer may see: their own (signed in), or any order with a
 * valid link token. Anything else is a 404, so order numbers cannot be probed.
 */
export async function findViewableOrder(number: string, viewer: Viewer): Promise<FullOrder> {
  const order = await prisma.order.findUnique({
    where: { orderNumber: number.toUpperCase() },
    include: orderInclude,
  });
  const allowed =
    order &&
    ((viewer.userId && order.userId === viewer.userId) ||
      isValidOrderToken(order.id, viewer.token));
  if (!order || !allowed) throw AppError.notFound("Order");
  return order;
}

export async function getOrder(number: string, viewer: Viewer): Promise<OrderDTO> {
  return toOrderDTO(await findViewableOrder(number, viewer), await returnWindowDays());
}

/** Customer return request (owner or order-link holder). */
export async function requestReturnByCustomer(
  number: string,
  viewer: Viewer,
  input: ReturnRequestInput,
): Promise<OrderDTO> {
  const order = await findViewableOrder(number, viewer);
  await requestReturn(order.id, input);
  return getOrder(number, viewer);
}

export async function listMyOrders(userId: string, page: { page: number; limit: number }) {
  const where = { userId };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { placedAt: "desc" },
      ...skipTake(page),
    }),
    prisma.order.count({ where }),
  ]);
  return paginated(rows.map(toOrderListItem), { ...page, total });
}

/** "Track my order" with the order number and the email it was placed with. */
export async function trackOrder(number: string, email: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber: number },
    include: orderInclude,
  });
  if (!order || order.email.toLowerCase() !== email) {
    throw AppError.notFound("We couldn't find an order with that number and email");
  }
  return toTracking(order);
}

export async function cancelByCustomer(number: string, viewer: Viewer): Promise<OrderDTO> {
  const order = await findViewableOrder(number, viewer);
  const updated = await cancelOrder(order.id, {
    reason: "Cancelled by the customer.",
    changedBy: viewer.userId ?? null,
    allowed: [...CUSTOMER_CANCELLABLE],
  });
  return toOrderDTO(updated, await returnWindowDays());
}

/** Payment details to (re)open the card form for an unpaid order. */
export async function paymentSession(number: string, viewer: Viewer): Promise<PaymentSessionDTO> {
  const order = await findViewableOrder(number, viewer);
  const provider = getPaymentProvider();
  const intent = order.payments.find((p) => p.providerRef);
  if (!canPay(order) || !intent || !provider)
    throw AppError.conflict("This order is not awaiting payment");
  return {
    provider: provider.name,
    clientSecret: await provider.getClientSecret(intent.providerRef!),
    publishableKey: provider.publishableKey,
    amount: order.grandTotal,
    currency: order.currency,
  };
}
