import type { AdminCustomerDTO, AdminCustomerListItemDTO } from "@hoodie/types";
import type { CustomerListQuery } from "@hoodie/validation";
import { Prisma } from "@prisma/client";
import { paginated } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { adminListInclude, toAdminListItem } from "../orders/admin-orders.service";
import { SALE_STATUSES } from "./reports.service";

const like = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const SORT: Record<CustomerListQuery["sort"], Prisma.Sql> = {
  newest: Prisma.sql`u."createdAt" DESC`,
  oldest: Prisma.sql`u."createdAt" ASC`,
  spent: Prisma.sql`spent DESC, u."createdAt" DESC`,
  orders: Prisma.sql`orders DESC, u."createdAt" DESC`,
  name: Prisma.sql`lower(u.name) ASC`,
};

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  isBlocked: boolean;
  emailVerified: Date | null;
  orders: bigint;
  spent: bigint;
  lastOrderAt: Date | null;
}

/** Lifetime stats per customer: sale orders only, net of refunds. */
const STATS = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT count(*) AS orders,
      COALESCE(sum(o."grandTotal" - COALESCE(
        (SELECT sum(p."refundedAmount") FROM "Payment" p WHERE p."orderId" = o.id), 0)), 0) AS spent,
      max(o."placedAt") AS "lastOrderAt"
    FROM "Order" o
    WHERE o."userId" = u.id AND o.status::text = ANY(${SALE_STATUSES})
  ) s ON true`;

const toItem = (r: Row): AdminCustomerListItemDTO => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  createdAt: r.createdAt.toISOString(),
  isBlocked: r.isBlocked,
  emailVerified: r.emailVerified !== null,
  orderCount: Number(r.orders),
  totalSpent: Number(r.spent),
  lastOrderAt: r.lastOrderAt?.toISOString() ?? null,
});

export async function listCustomers(q: CustomerListQuery) {
  const conds: Prisma.Sql[] = [Prisma.sql`u.role = 'CUSTOMER'`];
  if (q.q) {
    const term = like(q.q);
    conds.push(
      Prisma.sql`(u.name ILIKE ${term} OR u.email ILIKE ${term} OR u.phone ILIKE ${term})`,
    );
  }
  if (q.status) conds.push(Prisma.sql`u."isBlocked" = ${q.status === "blocked"}`);
  const where = Prisma.join(conds, " AND ");

  const [rows, count] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT u.id, u.name, u.email, u.phone, u."createdAt", u."isBlocked", u."emailVerified",
        s.orders, s.spent, s."lastOrderAt"
      FROM "User" u ${STATS}
      WHERE ${where}
      ORDER BY ${SORT[q.sort]}, u.id
      LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "User" u WHERE ${where}`,
  ]);
  return paginated(rows.map(toItem), {
    page: q.page,
    limit: q.limit,
    total: Number(count[0]?.n ?? 0),
  });
}

export async function getCustomer(id: string): Promise<AdminCustomerDTO> {
  const [row] = await prisma.$queryRaw<Row[]>`
    SELECT u.id, u.name, u.email, u.phone, u."createdAt", u."isBlocked", u."emailVerified",
      s.orders, s.spent, s."lastOrderAt"
    FROM "User" u ${STATS}
    WHERE u.id = ${id} AND u.role = 'CUSTOMER'`;
  if (!row) throw AppError.notFound("Customer");

  const [user, orders, first] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        adminNote: true,
        lastLoginAt: true,
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      },
    }),
    prisma.order.findMany({
      where: { userId: id },
      include: adminListInclude,
      orderBy: { placedAt: "desc" },
      take: 50,
    }),
    prisma.order.findFirst({
      where: { userId: id, status: { in: SALE_STATUSES } },
      orderBy: { placedAt: "asc" },
      select: { placedAt: true },
    }),
  ]);
  const item = toItem(row);
  return {
    ...item,
    adminNote: user.adminNote,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    averageOrderValue: item.orderCount ? Math.round(item.totalSpent / item.orderCount) : 0,
    firstOrderAt: first?.placedAt.toISOString() ?? null,
    addresses: user.addresses.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      isDefault: a.isDefault,
    })),
    orders: orders.map(toAdminListItem),
  };
}

async function assertCustomer(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user || user.role !== "CUSTOMER") throw AppError.notFound("Customer");
}

export async function updateCustomerNote(id: string, adminNote: string | null) {
  await assertCustomer(id);
  await prisma.user.update({ where: { id }, data: { adminNote } });
  return getCustomer(id);
}

/** Blocking signs the customer out everywhere (refresh tokens revoked). */
export async function setBlocked(id: string, isBlocked: boolean) {
  await assertCustomer(id);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { isBlocked } }),
    ...(isBlocked
      ? [
          prisma.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]
      : []),
  ]);
  return getCustomer(id);
}
