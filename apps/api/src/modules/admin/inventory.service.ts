import type { InventoryRowDTO, StockAdjustmentDTO } from "@hoodie/types";
import type { InventoryQuery } from "@hoodie/validation";
import { Prisma } from "@prisma/client";
import { paginated } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
const like = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** A variant needs attention when its available units are at or below its threshold. */
export const LOW_STOCK_SQL = Prisma.sql`v."isActive" AND p.status <> 'ARCHIVED' AND v.stock - v.reserved <= v."lowStockAt"`;

const SORT: Record<InventoryQuery["sort"], Prisma.Sql> = {
  stock_asc: Prisma.sql`v.stock - v.reserved ASC, p.title ASC, v.sku ASC`,
  stock_desc: Prisma.sql`v.stock - v.reserved DESC, p.title ASC, v.sku ASC`,
  product: Prisma.sql`p.title ASC, v.color ASC, v.sku ASC`,
  sku: Prisma.sql`v.sku ASC`,
};

interface Row {
  variantId: string;
  productId: string;
  productTitle: string;
  productStatus: InventoryRowDTO["productStatus"];
  image: string | null;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number;
  stock: number;
  reserved: number;
  lowStockAt: number;
  isActive: boolean;
}

const toRow = (r: Row): InventoryRowDTO => ({ ...r, available: r.stock - r.reserved });

function whereFor(q: Pick<InventoryQuery, "q" | "stock" | "category">): Prisma.Sql {
  const conds: Prisma.Sql[] = [Prisma.sql`p.status <> 'ARCHIVED'`];
  if (q.q) {
    const term = like(q.q);
    conds.push(Prisma.sql`(p.title ILIKE ${term} OR v.sku ILIKE ${term} OR v.color ILIKE ${term})`);
  }
  if (q.stock === "low") conds.push(LOW_STOCK_SQL);
  if (q.stock === "out") conds.push(Prisma.sql`v."isActive" AND v.stock - v.reserved <= 0`);
  if (q.category) {
    conds.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "_CategoryToProduct" cp JOIN "Category" c ON c.id = cp."A"
      WHERE cp."B" = p.id AND c.slug = ${q.category})`);
  }
  return Prisma.join(conds, " AND ");
}

const SELECT = Prisma.sql`
  SELECT v.id AS "variantId", p.id AS "productId", p.title AS "productTitle",
    p.status::text AS "productStatus",
    (SELECT url FROM "ProductImage" im WHERE im."productId" = p.id
       AND (im.color IS NULL OR lower(im.color) = lower(v.color))
     ORDER BY (im.color IS NULL), im.position LIMIT 1) AS image,
    v.sku, v.size, v.color, v."colorHex", COALESCE(v.price, p."basePrice") AS price,
    v.stock, v.reserved, v."lowStockAt", v."isActive"
  FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"`;

export async function listInventory(q: InventoryQuery) {
  const where = whereFor(q);
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<Row[]>`${SELECT} WHERE ${where} ORDER BY ${SORT[q.sort]}
      LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE ${where}`,
  ]);
  return paginated(rows.map(toRow), {
    page: q.page,
    limit: q.limit,
    total: Number(count[0]?.n ?? 0),
  });
}

/** Variants at or below their low-stock threshold, emptiest first. */
export async function lowStock(limit = 8): Promise<InventoryRowDTO[]> {
  const rows = await prisma.$queryRaw<Row[]>`${SELECT} WHERE ${LOW_STOCK_SQL}
    ORDER BY v.stock - v.reserved ASC, p.title ASC LIMIT ${limit}`;
  return rows.map(toRow);
}

export async function lowStockCount(): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
    WHERE ${LOW_STOCK_SQL}`;
  return Number(row?.n ?? 0);
}

/** Stock adjustment history of a variant, with the staff member's name. */
export async function adjustmentHistory(variantId: string): Promise<StockAdjustmentDTO[]> {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw AppError.notFound("Variant");
  const rows = await prisma.inventoryAdjustment.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const admins = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.adminId).filter((id): id is string => !!id) } },
    select: { id: true, name: true },
  });
  const names = new Map(admins.map((a) => [a.id, a.name]));
  return rows.map((r) => ({
    id: r.id,
    change: r.change,
    reason: r.reason,
    note: r.note,
    by: r.adminId ? (names.get(r.adminId) ?? "Staff") : null,
    createdAt: r.createdAt.toISOString(),
  }));
}
