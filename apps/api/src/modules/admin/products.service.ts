import type { AdminProductListItemDTO, AdminVariantDTO } from "@hoodie/types";
import { ErrorCode } from "@hoodie/types";
import type {
  AdminProductListQuery,
  BulkProductActionInput,
  CreateProductInput,
  StockAdjustmentInput,
  UpdateProductInput,
  UpdateVariantInput,
  VariantInput,
  generateVariantsSchema,
} from "@hoodie/validation";
import type { Prisma, ProductStatus } from "@prisma/client";
import type { z } from "zod";
import { paginated, skipTake } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { uniqueSlug } from "../../lib/slug";
import { AppError } from "../../utils/app-error";
import { available, effectivePrice } from "../catalog/catalog.mapper";
import { afterStockIncrease } from "../engagement/stock-alerts";

const ORDER_BY: Record<AdminProductListQuery["sort"], Prisma.ProductOrderByWithRelationInput> = {
  updated: { updatedAt: "desc" },
  newest: { createdAt: "desc" },
  title: { title: "asc" },
  price_asc: { basePrice: "asc" },
  price_desc: { basePrice: "desc" },
  best_selling: { soldCount: "desc" },
};

export async function listProducts(q: AdminProductListQuery) {
  const and: Prisma.ProductWhereInput[] = [
    // Archived products are hidden unless asked for explicitly.
    q.status ? { status: q.status } : { status: { not: "ARCHIVED" } },
  ];
  if (q.q) {
    and.push({
      OR: [
        { title: { contains: q.q, mode: "insensitive" } },
        { slug: { contains: q.q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (q.category) and.push({ categories: { some: { slug: q.category } } });
  if (q.lowStock) {
    and.push({
      variants: {
        some: { isActive: true, stock: { lte: prisma.productVariant.fields.lowStockAt } },
      },
    });
  }
  const where: Prisma.ProductWhereInput = { AND: and };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [ORDER_BY[q.sort], { id: "asc" }],
      include: {
        images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
        variants: { select: { stock: true } },
      },
      ...skipTake(q),
    }),
    prisma.product.count({ where }),
  ]);

  const data = rows.map((p): AdminProductListItemDTO => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    basePrice: p.basePrice,
    image: p.images[0]?.url ?? null,
    variantCount: p.variants.length,
    totalStock: p.variants.reduce((n, v) => n + v.stock, 0),
    soldCount: p.soldCount,
    updatedAt: p.updatedAt.toISOString(),
  }));
  return paginated(data, { page: q.page, limit: q.limit, total });
}

const adminInclude = {
  variants: { orderBy: [{ color: "asc" }, { createdAt: "asc" }] },
  images: { orderBy: { position: "asc" } },
  categories: { select: { id: true, slug: true, name: true } },
  collections: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.ProductInclude;

type AdminProduct = Prisma.ProductGetPayload<{ include: typeof adminInclude }>;

function toAdminVariant(v: AdminProduct["variants"][number], basePrice: number): AdminVariantDTO {
  return {
    id: v.id,
    sku: v.sku,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    price: v.price,
    effectivePrice: effectivePrice(v, basePrice),
    stock: v.stock,
    reserved: v.reserved,
    available: available(v),
    lowStockAt: v.lowStockAt,
    weightGrams: v.weightGrams,
    isActive: v.isActive,
  };
}

function toAdminProduct(p: AdminProduct) {
  const { variants, images, ...rest } = p;
  return {
    ...rest,
    images: images.map(({ id, url, alt, color, position }) => ({ id, url, alt, color, position })),
    variants: variants.map((v) => toAdminVariant(v, p.basePrice)),
  };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: adminInclude });
  if (!product) throw AppError.notFound("Product");
  return toAdminProduct(product);
}

/** 400 if any category/collection id does not exist (clearer than a foreign key error). */
async function assertTaxonomyExists(categoryIds?: string[], collectionIds?: string[]) {
  const [cats, cols] = await Promise.all([
    categoryIds?.length ? prisma.category.count({ where: { id: { in: categoryIds } } }) : 0,
    collectionIds?.length ? prisma.collection.count({ where: { id: { in: collectionIds } } }) : 0,
  ]);
  if (categoryIds && cats !== new Set(categoryIds).size)
    throw AppError.badRequest("Unknown category id");
  if (collectionIds && cols !== new Set(collectionIds).size)
    throw AppError.badRequest("Unknown collection id");
}

async function assertSkusFree(skus: string[], exceptVariantId?: string) {
  const taken = await prisma.productVariant.findMany({
    where: { sku: { in: skus }, ...(exceptVariantId ? { id: { not: exceptVariantId } } : {}) },
    select: { sku: true },
  });
  if (taken.length) {
    throw AppError.conflict(`SKU already in use: ${taken.map((t) => t.sku).join(", ")}`, {
      skus: taken.map((t) => t.sku),
    });
  }
}

const slugTaken = async (slug: string, exceptId?: string) =>
  (await prisma.product.count({
    where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
  })) > 0;

const publishedAtFor = (status: ProductStatus | undefined, current: Date | null) =>
  status === "ACTIVE" && !current ? new Date() : undefined;

export async function createProduct(input: CreateProductInput) {
  const { categoryIds, collectionIds, images, variants, slug, ...fields } = input;
  await assertTaxonomyExists(categoryIds, collectionIds);
  if (variants.length) await assertSkusFree(variants.map((v) => v.sku));

  if (slug && (await slugTaken(slug)))
    throw AppError.conflict("This URL slug is already used by another product");
  const finalSlug = slug ?? (await uniqueSlug(input.title, (s) => slugTaken(s)));

  const product = await prisma.product.create({
    data: {
      ...fields,
      slug: finalSlug,
      publishedAt: publishedAtFor(fields.status, null),
      categories: { connect: categoryIds.map((id) => ({ id })) },
      collections: { connect: collectionIds.map((id) => ({ id })) },
      images: { create: images.map((img, i) => ({ ...img, position: img.position || i })) },
      variants: { create: variants },
    },
    include: adminInclude,
  });
  return toAdminProduct(product);
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const current = await prisma.product.findUnique({
    where: { id },
    select: { publishedAt: true, basePrice: true },
  });
  if (!current) throw AppError.notFound("Product");

  const { categoryIds, collectionIds, images, slug, ...fields } = input;
  await assertTaxonomyExists(categoryIds, collectionIds);
  if (slug && (await slugTaken(slug, id)))
    throw AppError.conflict("This URL slug is already used by another product");

  // compare-at must stay above the price even when only one of them changes.
  const basePrice = fields.basePrice ?? current.basePrice;
  if (fields.compareAtPrice != null && fields.compareAtPrice <= basePrice) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Compare-at price must be higher than the price",
      {
        fieldErrors: { compareAtPrice: ["Compare-at price must be higher than the price"] },
      },
    );
  }

  const product = await prisma.$transaction(async (tx) => {
    if (images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: images.map((img, i) => ({ ...img, productId: id, position: i })),
      });
    }
    return tx.product.update({
      where: { id },
      data: {
        ...fields,
        ...(slug ? { slug } : {}),
        publishedAt: publishedAtFor(fields.status, current.publishedAt),
        ...(categoryIds ? { categories: { set: categoryIds.map((cid) => ({ id: cid })) } } : {}),
        ...(collectionIds
          ? { collections: { set: collectionIds.map((cid) => ({ id: cid })) } }
          : {}),
      },
      include: adminInclude,
    });
  });
  return toAdminProduct(product);
}

/** Products are archived rather than deleted, because orders reference them. */
export async function archiveProduct(id: string) {
  const { count } = await prisma.product.updateMany({
    where: { id },
    data: { status: "ARCHIVED", isFeatured: false },
  });
  if (count === 0) throw AppError.notFound("Product");
}

export async function bulkAction({ ids, action }: BulkProductActionInput) {
  const status: Record<BulkProductActionInput["action"], ProductStatus> = {
    publish: "ACTIVE",
    unpublish: "DRAFT",
    archive: "ARCHIVED",
  };
  return prisma.$transaction(async (tx) => {
    if (action === "publish") {
      await tx.product.updateMany({
        where: { id: { in: ids }, publishedAt: null },
        data: { publishedAt: new Date() },
      });
    }
    const { count } = await tx.product.updateMany({
      where: { id: { in: ids } },
      data: { status: status[action] },
    });
    return { updated: count };
  });
}

// ───────────── Variants ─────────────

const colorCode = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase() || "CLR";

/**
 * Creates every missing size × colour combination. Existing combinations are
 * left untouched, so it is safe to run again after adding a new colour.
 */
export async function generateVariants(
  productId: string,
  input: z.output<typeof generateVariantsSchema>,
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { variants: { select: { size: true, color: true } } },
  });
  if (!product) throw AppError.notFound("Product");

  const existing = new Set(product.variants.map((v) => `${v.size}|${v.color.toLowerCase()}`));
  const toCreate = input.colors.flatMap((color) =>
    input.sizes
      .filter((size) => !existing.has(`${size}|${color.name.toLowerCase()}`))
      .map((size) => ({
        productId,
        size,
        color: color.name,
        colorHex: color.hex,
        sku: `${input.skuPrefix}-${colorCode(color.name)}-${size}`,
        stock: input.initialStock,
      })),
  );

  if (toCreate.length) {
    await assertSkusFree(toCreate.map((v) => v.sku));
    await prisma.productVariant.createMany({ data: toCreate });
  }
  const result = await getProduct(productId);
  return {
    created: toCreate.length,
    skipped: input.sizes.length * input.colors.length - toCreate.length,
    variants: result.variants,
  };
}

export async function createVariant(productId: string, input: VariantInput) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { basePrice: true },
  });
  if (!product) throw AppError.notFound("Product");
  await assertSkusFree([input.sku]);
  const duplicate = await prisma.productVariant.findFirst({
    where: { productId, size: input.size, color: { equals: input.color, mode: "insensitive" } },
  });
  if (duplicate) throw AppError.conflict(`A ${input.size} / ${input.color} variant already exists`);

  const variant = await prisma.productVariant.create({ data: { ...input, productId } });
  return toAdminVariant(variant, product.basePrice);
}

async function findVariant(id: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id },
    include: { product: { select: { basePrice: true } } },
  });
  if (!variant) throw AppError.notFound("Variant");
  return variant;
}

export async function updateVariant(id: string, input: UpdateVariantInput) {
  const current = await findVariant(id);
  if (input.sku) await assertSkusFree([input.sku], id);
  const variant = await prisma.productVariant.update({ where: { id }, data: input });
  return toAdminVariant(variant, current.product.basePrice);
}

/** Variants that were ever ordered can only be deactivated, to keep order history intact. */
export async function deleteVariant(id: string) {
  await findVariant(id);
  const ordered = await prisma.orderItem.count({ where: { variantId: id } });
  if (ordered > 0) {
    throw AppError.conflict(
      "This variant has been ordered and cannot be deleted. Deactivate it instead.",
    );
  }
  await prisma.productVariant.delete({ where: { id } });
}

/**
 * Changes stock by `change` and records why. Stock can never drop below the
 * units reserved by pending checkouts (and therefore never below zero).
 */
export async function adjustStock(variantId: string, input: StockAdjustmentInput, adminId: string) {
  const current = await findVariant(variantId);

  const variant = await prisma.$transaction(async (tx) => {
    // Single atomic statement: safe against concurrent checkouts and adjustments.
    const rows = await tx.$queryRaw<{ stock: number }[]>`
      UPDATE "ProductVariant"
      SET stock = stock + ${input.change}, "updatedAt" = now()
      WHERE id = ${variantId} AND stock + ${input.change} >= reserved
      RETURNING stock`;
    if (rows.length === 0) {
      throw AppError.conflict(
        "Stock cannot go below zero or below units reserved by pending orders",
        {
          stock: current.stock,
          reserved: current.reserved,
        },
      );
    }
    await tx.inventoryAdjustment.create({
      data: { variantId, change: input.change, reason: input.reason, note: input.note, adminId },
    });
    const updated = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    return toAdminVariant(updated, current.product.basePrice);
  });
  if (input.change > 0) await afterStockIncrease([variantId]);
  return variant;
}

export async function stockHistory(variantId: string) {
  await findVariant(variantId);
  return prisma.inventoryAdjustment.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
