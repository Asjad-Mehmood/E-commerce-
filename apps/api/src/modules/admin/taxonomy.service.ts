import type {
  CreateCategoryInput,
  CreateCollectionInput,
  UpdateCategoryInput,
  UpdateCollectionInput,
} from "@hoodie/validation";
import { prisma } from "../../lib/prisma";
import { uniqueSlug } from "../../lib/slug";
import { AppError } from "../../utils/app-error";

const withCount = { _count: { select: { products: true } } } as const;

// ───────────── Categories ─────────────

export const listCategories = () =>
  prisma.category.findMany({ include: withCount, orderBy: [{ position: "asc" }, { name: "asc" }] });

const categorySlugTaken = async (slug: string, exceptId?: string) =>
  (await prisma.category.count({
    where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
  })) > 0;

async function assertValidParent(parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw AppError.badRequest("A category cannot be its own parent");

  // Walk up from the new parent; finding ourselves means the change would create a loop.
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    if (!node) throw AppError.badRequest("Parent category not found");
    if (selfId && node.parentId === selfId) {
      throw AppError.badRequest("A category cannot be moved under one of its own sub-categories");
    }
    cursor = node.parentId;
  }
}

export async function createCategory(input: CreateCategoryInput) {
  await assertValidParent(input.parentId);
  if (input.slug && (await categorySlugTaken(input.slug)))
    throw AppError.conflict("This slug is already in use");
  const slug = input.slug ?? (await uniqueSlug(input.name, (s) => categorySlugTaken(s)));
  return prisma.category.create({ data: { ...input, slug }, include: withCount });
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  if (!(await prisma.category.findUnique({ where: { id } }))) throw AppError.notFound("Category");
  await assertValidParent(input.parentId, id);
  if (input.slug && (await categorySlugTaken(input.slug, id)))
    throw AppError.conflict("This slug is already in use");
  return prisma.category.update({ where: { id }, data: input, include: withCount });
}

/** Sub-categories move up to the top level; products simply lose this category. */
export async function deleteCategory(id: string) {
  const { count } = await prisma.category.deleteMany({ where: { id } });
  if (count === 0) throw AppError.notFound("Category");
}

// ───────────── Collections ─────────────

export const listCollections = () =>
  prisma.collection.findMany({
    include: withCount,
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

const collectionSlugTaken = async (slug: string, exceptId?: string) =>
  (await prisma.collection.count({
    where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
  })) > 0;

export async function createCollection(input: CreateCollectionInput) {
  if (input.slug && (await collectionSlugTaken(input.slug)))
    throw AppError.conflict("This slug is already in use");
  const slug = input.slug ?? (await uniqueSlug(input.name, (s) => collectionSlugTaken(s)));
  return prisma.collection.create({ data: { ...input, slug }, include: withCount });
}

export async function updateCollection(id: string, input: UpdateCollectionInput) {
  if (!(await prisma.collection.findUnique({ where: { id } })))
    throw AppError.notFound("Collection");
  if (input.slug && (await collectionSlugTaken(input.slug, id)))
    throw AppError.conflict("This slug is already in use");
  return prisma.collection.update({ where: { id }, data: input, include: withCount });
}

export async function deleteCollection(id: string) {
  const { count } = await prisma.collection.deleteMany({ where: { id } });
  if (count === 0) throw AppError.notFound("Collection");
}
