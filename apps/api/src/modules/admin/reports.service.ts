import type {
  CategoryReportRowDTO,
  InventoryValuationRowDTO,
  OrderStatus,
  ProductReportRowDTO,
  SalesReportDTO,
  SalesReportRowDTO,
} from "@hoodie/types";
import { Prisma } from "@prisma/client";
import { dayRange } from "../../lib/dates";
import { prisma } from "../../lib/prisma";
import { storeTimeZone } from "../../lib/settings";

/**
 * Orders that count as sales: everything a customer committed to (paid, or
 * confirmed for Cash on Delivery). Unpaid and cancelled orders are excluded.
 * Refunds are subtracted from the order they belong to, so "net" for a period
 * means "what the orders placed in that period are worth now".
 */
export const SALE_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURNED",
  "REFUNDED",
];

export type GroupBy = "day" | "week" | "month";

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** Local date of an order, as a SQL expression. */
const localTime = (zone: string) =>
  Prisma.sql`(o."placedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${zone}`;

interface Totals {
  orders: number;
  units: number;
  gross: number;
  discounts: number;
  shipping: number;
  refunds: number;
  net: number;
}

/** Order totals for orders placed in [start, end), grouped by local period (or one row). */
async function aggregate(
  start: Date,
  end: Date,
  zone: string,
  groupBy?: GroupBy,
): Promise<(Totals & { period: string | null })[]> {
  const period = groupBy
    ? Prisma.sql`to_char(date_trunc(${groupBy}, ${localTime(zone)}), 'YYYY-MM-DD')`
    : Prisma.sql`NULL::text`;
  const rows = await prisma.$queryRaw<
    {
      period: string | null;
      orders: bigint;
      units: bigint | null;
      gross: bigint | null;
      discounts: bigint | null;
      shipping: bigint | null;
      refunds: bigint | null;
    }[]
  >`
    SELECT ${period} AS period,
      count(*) AS orders,
      sum(u.units) AS units,
      sum(o."grandTotal") AS gross,
      sum(o."discountTotal") AS discounts,
      sum(o."shippingTotal" + o."codFee") AS shipping,
      sum(COALESCE(r.refunded, 0)) AS refunds
    FROM "Order" o
    LEFT JOIN LATERAL (
      SELECT sum("refundedAmount") AS refunded FROM "Payment" p WHERE p."orderId" = o.id
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT sum(quantity) AS units FROM "OrderItem" i WHERE i."orderId" = o.id
    ) u ON true
    WHERE o.status::text = ANY(${SALE_STATUSES})
      AND o."placedAt" >= ${start} AND o."placedAt" < ${end}
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((r) => ({
    period: r.period,
    orders: n(r.orders),
    units: n(r.units),
    gross: n(r.gross),
    discounts: n(r.discounts),
    shipping: n(r.shipping),
    refunds: n(r.refunds),
    net: n(r.gross) - n(r.refunds),
  }));
}

const EMPTY: Totals = {
  orders: 0,
  units: 0,
  gross: 0,
  discounts: 0,
  shipping: 0,
  refunds: 0,
  net: 0,
};

/** Totals for [start, end). */
export async function totalsBetween(start: Date, end: Date, zone: string): Promise<Totals> {
  const [row] = await aggregate(start, end, zone);
  return row ? { ...row } : { ...EMPTY };
}

/** Every period start from `from` to `to`, so empty days still appear on charts. */
export function periodStarts(from: string, to: string, groupBy: GroupBy): string[] {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const d = new Date(`${from}T00:00:00Z`);
  if (groupBy === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  if (groupBy === "month") d.setUTCDate(1);
  const out: string[] = [];
  while (iso(d) <= to) {
    out.push(iso(d));
    if (groupBy === "day") d.setUTCDate(d.getUTCDate() + 1);
    else if (groupBy === "week") d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export async function salesReport(q: {
  from?: string;
  to?: string;
  groupBy: GroupBy;
}): Promise<SalesReportDTO> {
  const zone = await storeTimeZone();
  const range = dayRange(zone, q.from, q.to, 30);
  const rows = await aggregate(range.start, range.end, zone, q.groupBy);
  const byPeriod = new Map(rows.map((r) => [r.period, r]));
  const filled: SalesReportRowDTO[] = periodStarts(range.from, range.to, q.groupBy).map(
    (period) => {
      const { period: _p, ...totals } = byPeriod.get(period) ?? { period, ...EMPTY };
      return { period, ...totals };
    },
  );
  const totals = filled.reduce(
    (t, r) => ({
      orders: t.orders + r.orders,
      units: t.units + r.units,
      gross: t.gross + r.gross,
      discounts: t.discounts + r.discounts,
      shipping: t.shipping + r.shipping,
      refunds: t.refunds + r.refunds,
      net: t.net + r.net,
    }),
    { ...EMPTY },
  );
  return { from: range.from, to: range.to, groupBy: q.groupBy, rows: filled, totals };
}

/** Best sellers by revenue (line totals, before order-level discounts). */
export async function productReport(
  q: { from?: string; to?: string },
  limit = 50,
): Promise<ProductReportRowDTO[]> {
  const zone = await storeTimeZone();
  const range = dayRange(zone, q.from, q.to, 30);
  const rows = await prisma.$queryRaw<
    { productId: string; title: string; orders: bigint; units: bigint; revenue: bigint }[]
  >`
    SELECT i."productId", max(i."productTitle") AS title,
      count(DISTINCT o.id) AS orders, sum(i.quantity) AS units, sum(i."lineTotal") AS revenue
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE o.status::text = ANY(${SALE_STATUSES}) AND o.status <> 'REFUNDED'
      AND o."placedAt" >= ${range.start} AND o."placedAt" < ${range.end}
    GROUP BY i."productId"
    ORDER BY revenue DESC, units DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    productId: r.productId,
    title: r.title,
    orders: n(r.orders),
    units: n(r.units),
    revenue: n(r.revenue),
  }));
}

/**
 * Sales by category. A product in two categories counts in both, so the
 * category rows can add up to more than total sales.
 */
export async function categoryReport(q: {
  from?: string;
  to?: string;
}): Promise<CategoryReportRowDTO[]> {
  const zone = await storeTimeZone();
  const range = dayRange(zone, q.from, q.to, 30);
  const rows = await prisma.$queryRaw<
    { categoryId: string | null; name: string | null; units: bigint; revenue: bigint }[]
  >`
    SELECT c.id AS "categoryId", c.name, sum(i.quantity) AS units, sum(i."lineTotal") AS revenue
    FROM "OrderItem" i
    JOIN "Order" o ON o.id = i."orderId"
    LEFT JOIN "_CategoryToProduct" cp ON cp."B" = i."productId"
    LEFT JOIN "Category" c ON c.id = cp."A"
    WHERE o.status::text = ANY(${SALE_STATUSES}) AND o.status <> 'REFUNDED'
      AND o."placedAt" >= ${range.start} AND o."placedAt" < ${range.end}
    GROUP BY c.id, c.name
    ORDER BY revenue DESC`;
  return rows.map((r) => ({
    categoryId: r.categoryId,
    name: r.name ?? "Uncategorised",
    units: n(r.units),
    revenue: n(r.revenue),
  }));
}

/** Units on hand and their value at the current selling price, per product. */
export async function inventoryValuation(): Promise<InventoryValuationRowDTO[]> {
  const rows = await prisma.$queryRaw<
    {
      productId: string;
      title: string;
      status: InventoryValuationRowDTO["status"];
      units: bigint;
      value: bigint;
    }[]
  >`
    SELECT p.id AS "productId", p.title, p.status::text AS status,
      COALESCE(sum(v.stock), 0) AS units,
      COALESCE(sum(v.stock::bigint * COALESCE(v.price, p."basePrice")), 0) AS value
    FROM "Product" p LEFT JOIN "ProductVariant" v ON v."productId" = p.id
    WHERE p.status <> 'ARCHIVED'
    GROUP BY p.id
    ORDER BY value DESC, p.title`;
  return rows.map((r) => ({
    productId: r.productId,
    title: r.title,
    status: r.status,
    units: n(r.units),
    retailValue: n(r.value),
  }));
}
