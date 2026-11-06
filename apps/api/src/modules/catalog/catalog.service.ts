import type { CategoryDTO, CollectionDTO, FiltersDTO, ProductSort } from "@hoodie/types";
import { compareSizes, FITS } from "@hoodie/types";
import type { ProductListQuery } from "@hoodie/validation";
import type { Prisma } from "@prisma/client";
import { paginated, skipTake } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { cardInclude, detailInclude, toProductCard, toProductDetail } from "./catalog.mapper";

const ACTIVE = "ACTIVE" as const;

/** A category slug matches the category itself and its direct children. */
const inCategory = (slug: string): Prisma.ProductWhereInput => ({
  categories: { some: { OR: [{ slug }, { parent: { slug } }] } },
});

const inCollection = (slug: string): Prisma.ProductWhereInput => ({
  collections: { some: { slug } },
});

function listWhere(q: ProductListQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ status: ACTIVE }];

  if (q.q) {
    and.push({
      OR: [
        { title: { contains: q.q, mode: "insensitive" } },
        { description: { contains: q.q, mode: "insensitive" } },
        { categories: { some: { name: { contains: q.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (q.category) and.push(inCategory(q.category));
  if (q.collection) and.push(inCollection(q.collection));
  if (q.fit?.length) and.push({ fit: { in: q.fit } });
  // Price filters use the product's base price (variant overrides are rare).
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    and.push({ basePrice: { gte: q.minPrice, lte: q.maxPrice } });
  }

  // Size / colour / stock must all hold for the SAME variant: "M in Black, in stock".
  if (q.size?.length || q.color?.length || q.inStock) {
    and.push({
      variants: {
        some: {
          isActive: true,
          ...(q.size?.length ? { size: { in: q.size } } : {}),
          ...(q.color?.length ? { color: { in: q.color } } : {}),
          ...(q.inStock ? { stock: { gt: prisma.productVariant.fields.reserved } } : {}),
        },
      },
    });
  }

  return { AND: and };
}

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  price_asc: [{ basePrice: "asc" }, { id: "asc" }],
  price_desc: [{ basePrice: "desc" }, { id: "asc" }],
  best_selling: [{ soldCount: "desc" }, { id: "asc" }],
  top_rated: [{ avgRating: "desc" }, { reviewCount: "desc" }, { id: "asc" }],
};

export async function listProducts(q: ProductListQuery) {
  const where = listWhere(q);
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: cardInclude,
      orderBy: ORDER_BY[q.sort],
      ...skipTake(q),
    }),
    prisma.product.count({ where }),
  ]);
  return paginated(products.map(toProductCard), { page: q.page, limit: q.limit, total });
}

export async function getProduct(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, status: ACTIVE },
    include: detailInclude,
  });
  if (!product) throw AppError.notFound("Product");
  return toProductDetail(product);
}

/** Best sellers from the same categories, topped up with overall best sellers. */
export async function relatedProducts(slug: string, limit = 8) {
  const product = await prisma.product.findFirst({
    where: { slug, status: ACTIVE },
    select: { id: true, categories: { select: { id: true } } },
  });
  if (!product) throw AppError.notFound("Product");

  const related = await prisma.product.findMany({
    where: {
      status: ACTIVE,
      id: { not: product.id },
      categories: { some: { id: { in: product.categories.map((c) => c.id) } } },
    },
    include: cardInclude,
    orderBy: [{ soldCount: "desc" }, { id: "asc" }],
    take: limit,
  });

  if (related.length < limit) {
    const fill = await prisma.product.findMany({
      where: { status: ACTIVE, id: { notIn: [product.id, ...related.map((p) => p.id)] } },
      include: cardInclude,
      orderBy: [{ soldCount: "desc" }, { id: "asc" }],
      take: limit - related.length,
    });
    related.push(...fill);
  }
  return related.map(toProductCard);
}

const activeCount = { _count: { select: { products: { where: { status: ACTIVE } } } } } as const;

/** Category tree (top-level categories with nested children). */
export async function listCategories(): Promise<CategoryDTO[]> {
  const rows = await prisma.category.findMany({
    include: activeCount,
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const nodes = new Map<string, CategoryDTO>(
    rows.map((c) => [
      c.id,
      {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        parentId: c.parentId,
        productCount: c._count.products,
        children: [],
      },
    ]),
  );
  const roots: CategoryDTO[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

export async function getCategory(slug: string): Promise<CategoryDTO> {
  const flatten = (nodes: CategoryDTO[]): CategoryDTO[] =>
    nodes.flatMap((n) => [n, ...flatten(n.children)]);
  const found = flatten(await listCategories()).find((c) => c.slug === slug);
  if (!found) throw AppError.notFound("Category");
  return found;
}

function toCollection(
  c: Prisma.CollectionGetPayload<{ include: typeof activeCount }>,
): CollectionDTO {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    bannerUrl: c.bannerUrl,
    isFeatured: c.isFeatured,
    productCount: c._count.products,
  };
}

export async function listCollections(featuredOnly: boolean): Promise<CollectionDTO[]> {
  const rows = await prisma.collection.findMany({
    where: featuredOnly ? { isFeatured: true } : undefined,
    include: activeCount,
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return rows.map(toCollection);
}

export async function getCollection(slug: string): Promise<CollectionDTO> {
  const c = await prisma.collection.findUnique({ where: { slug }, include: activeCount });
  if (!c) throw AppError.notFound("Collection");
  return toCollection(c);
}

/** Options for the filter sidebar, scoped to a category/collection when given. */
export async function getFilters(scope: {
  category?: string;
  collection?: string;
}): Promise<FiltersDTO> {
  const productWhere: Prisma.ProductWhereInput = {
    status: ACTIVE,
    ...(scope.category ? inCategory(scope.category) : {}),
    ...(scope.collection ? inCollection(scope.collection) : {}),
  };

  const [variants, fits, price] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true, product: productWhere },
      select: { size: true, color: true, colorHex: true },
      distinct: ["size", "color"],
    }),
    prisma.product.findMany({ where: productWhere, select: { fit: true }, distinct: ["fit"] }),
    prisma.product.aggregate({
      where: productWhere,
      _min: { basePrice: true },
      _max: { basePrice: true },
    }),
  ]);

  const colors = new Map<string, string | null>();
  for (const v of variants) if (!colors.has(v.color)) colors.set(v.color, v.colorHex);

  return {
    sizes: [...new Set(variants.map((v) => v.size))].sort(compareSizes),
    colors: [...colors]
      .map(([name, hex]) => ({ name, hex }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    fits: FITS.filter((f) => fits.some((p) => p.fit === f)),
    price: { min: price._min.basePrice ?? 0, max: price._max.basePrice ?? 0 },
  };
}
