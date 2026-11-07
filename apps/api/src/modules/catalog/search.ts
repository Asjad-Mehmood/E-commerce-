import type { SearchSuggestionsDTO } from "@hoodie/types";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { effectivePrice } from "./catalog.mapper";

/** Escapes LIKE wildcards so "50%" matches literally. */
const like = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Minimum pg_trgm word similarity for a typo match ("hodie" ≈ "Hoodie"). */
const FUZZY = 0.5;

export const searchTerms = (q: string) =>
  q
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter(Boolean)
    .slice(0, 5);

/**
 * Active products matching every word of the query, best match first. A word
 * matches the title, description, a category name or a colour, or is a close
 * spelling of a word in the title (pg_trgm). Title matches rank highest.
 */
export async function searchProductIds(q: string, limit = 500): Promise<string[]> {
  const terms = searchTerms(q);
  if (!terms.length) return [];

  const conditions = terms.map((t) => {
    const l = like(t);
    return Prisma.sql`(
      p.title ILIKE ${l} OR p.description ILIKE ${l}
      OR EXISTS (SELECT 1 FROM "_CategoryToProduct" cp JOIN "Category" c ON c.id = cp."A"
                 WHERE cp."B" = p.id AND c.name ILIKE ${l})
      OR EXISTS (SELECT 1 FROM "ProductVariant" v
                 WHERE v."productId" = p.id AND v."isActive" AND v.color ILIKE ${l})
      OR (length(${t}) >= 4 AND word_similarity(${t}, p.title) >= ${FUZZY})
    )`;
  });
  const score = Prisma.join(
    terms.map(
      (t) =>
        Prisma.sql`(CASE WHEN p.title ILIKE ${like(t)} THEN 2 ELSE 0 END + word_similarity(${t}, p.title))`,
    ),
    " + ",
  );

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM "Product" p
    WHERE p.status = 'ACTIVE' AND ${Prisma.join(conditions, " AND ")}
    ORDER BY ${score} DESC, p."soldCount" DESC, p.id
    LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

/** Autocomplete for the search box: a few products and categories. */
export async function suggest(q: string): Promise<SearchSuggestionsDTO> {
  const ids = await searchProductIds(q, 6);
  const terms = searchTerms(q);
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        title: true,
        basePrice: true,
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        variants: { where: { isActive: true }, select: { price: true } },
      },
    }),
    terms.length
      ? prisma.category.findMany({
          where: {
            AND: terms.map((t) => ({ name: { contains: t, mode: "insensitive" as const } })),
          },
          select: { slug: true, name: true },
          take: 3,
        })
      : [],
  ]);
  return {
    products: ids
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        image: p.images[0]?.url ?? null,
        price: Math.min(p.basePrice, ...p.variants.map((v) => effectivePrice(v, p.basePrice))),
      })),
    categories,
  };
}
