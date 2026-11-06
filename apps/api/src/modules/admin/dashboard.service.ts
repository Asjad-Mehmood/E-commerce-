import type { AdminNotificationsDTO, DashboardDTO, PaymentMethod } from "@hoodie/types";
import { addDays, dayOf, dayRange, startOfDay } from "../../lib/dates";
import { prisma } from "../../lib/prisma";
import { storeTimeZone } from "../../lib/settings";
import { adminListInclude, toAdminListItem } from "../orders/admin-orders.service";
import { lowStock, lowStockCount } from "./inventory.service";
import { productReport, SALE_STATUSES, salesReport, totalsBetween } from "./reports.service";

const TO_FULFIL = ["CONFIRMED", "PAID", "PROCESSING"] as const;

export async function getDashboard(days: number, now = new Date()): Promise<DashboardDTO> {
  const zone = await storeTimeZone();
  const range = dayRange(zone, undefined, undefined, days, now);
  const previous = {
    start: startOfDay(addDays(range.from, -days), zone),
    end: range.start,
  };
  const today = dayOf(now, zone);
  const todayStart = startOfDay(today, zone);
  const todayEnd = startOfDay(addDays(today, 1), zone);

  const [
    current,
    before,
    todayTotals,
    newCustomers,
    newCustomersBefore,
    report,
    top,
    low,
    recent,
    toFulfil,
    awaitingPayment,
    mix,
  ] = await Promise.all([
    totalsBetween(range.start, range.end, zone),
    totalsBetween(previous.start, previous.end, zone),
    totalsBetween(todayStart, todayEnd, zone),
    prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: range.start, lt: range.end } },
    }),
    prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: previous.start, lt: previous.end } },
    }),
    salesReport({ from: range.from, to: range.to, groupBy: "day" }),
    productReport({ from: range.from, to: range.to }, 5),
    lowStock(8),
    prisma.order.findMany({
      include: adminListInclude,
      orderBy: { placedAt: "desc" },
      take: 8,
    }),
    prisma.order.count({ where: { status: { in: [...TO_FULFIL] } } }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: {
        status: { in: SALE_STATUSES },
        placedAt: { gte: range.start, lt: range.end },
      },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
  ]);

  const images = await prisma.productImage.findMany({
    where: { productId: { in: top.map((t) => t.productId) } },
    orderBy: { position: "asc" },
    distinct: ["productId"],
    select: { productId: true, url: true },
  });
  const imageOf = new Map(images.map((i) => [i.productId, i.url]));
  const aov = (t: { net: number; orders: number }) => (t.orders ? Math.round(t.net / t.orders) : 0);

  return {
    range: { days, from: range.from, to: range.to },
    kpis: {
      sales: { value: current.net, previous: before.net },
      orders: { value: current.orders, previous: before.orders },
      averageOrderValue: { value: aov(current), previous: aov(before) },
      newCustomers: { value: newCustomers, previous: newCustomersBefore },
    },
    today: { sales: todayTotals.net, orders: todayTotals.orders },
    toFulfil,
    awaitingPayment,
    series: report.rows.map((r) => ({ date: r.period, sales: r.net, orders: r.orders })),
    topProducts: top.map((t) => ({
      productId: t.productId,
      title: t.title,
      image: imageOf.get(t.productId) ?? null,
      units: t.units,
      revenue: t.revenue,
    })),
    lowStock: low,
    recentOrders: recent.map(toAdminListItem),
    paymentMix: mix
      .map((m) => ({
        method: m.paymentMethod as PaymentMethod,
        orders: m._count._all,
        sales: m._sum.grandTotal ?? 0,
      }))
      .sort((a, b) => b.sales - a.sales),
  };
}

/** Small summary the admin top bar polls for its badges and new-order alerts. */
export async function getNotifications(): Promise<AdminNotificationsDTO> {
  const [toFulfil, newMessages, low, latest] = await Promise.all([
    prisma.order.count({ where: { status: { in: [...TO_FULFIL] } } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    lowStockCount(),
    prisma.order.findFirst({
      where: { status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
      orderBy: { placedAt: "desc" },
      select: { orderNumber: true, placedAt: true, grandTotal: true },
    }),
  ]);
  return {
    toFulfil,
    newMessages,
    lowStock: low,
    latestOrder: latest
      ? {
          number: latest.orderNumber,
          placedAt: latest.placedAt.toISOString(),
          grandTotal: latest.grandTotal,
        }
      : null,
  };
}
