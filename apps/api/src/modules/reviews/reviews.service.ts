import type {
  AdminReviewDTO,
  MyReviewDTO,
  ReviewDTO,
  ReviewEligibilityDTO,
  ReviewsPageDTO,
  ReviewSummaryDTO,
} from "@hoodie/types";
import type {
  adminReviewListQuerySchema,
  ReviewInput,
  reviewListQuerySchema,
} from "@hoodie/validation";
import type { OrderStatus, Prisma, Review } from "@prisma/client";
import type { z } from "zod";
import { paginated, skipTake } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { getSetting } from "../../lib/settings";
import { AppError } from "../../utils/app-error";

/** Order statuses that mean the customer received the item. */
const RECEIVED: OrderStatus[] = ["DELIVERED", "RETURN_REQUESTED", "RETURNED"];

/** "Ayesha Malik" → "Ayesha M." */
export function publicName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : (first ?? "Customer");
}

const toReview = (r: Review & { user: { name: string } }): ReviewDTO => ({
  id: r.id,
  rating: r.rating,
  title: r.title,
  body: r.body,
  author: publicName(r.user.name),
  createdAt: r.createdAt.toISOString(),
  adminReply: r.adminReply,
});

const toMine = (r: Review): MyReviewDTO => ({
  id: r.id,
  rating: r.rating,
  title: r.title,
  body: r.body,
  isApproved: r.isApproved,
  adminReply: r.adminReply,
  createdAt: r.createdAt.toISOString(),
});

async function activeProduct(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true, avgRating: true, reviewCount: true },
  });
  if (!product) throw AppError.notFound("Product");
  return product;
}

/** Recomputes the product's average rating and count from its approved reviews. */
export async function refreshRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      avgRating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      reviewCount: agg._count._all,
    },
  });
}

async function summary(productId: string): Promise<ReviewSummaryDTO> {
  const groups = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId, isApproved: true },
    _count: { _all: true },
  });
  const count = groups.reduce((n, g) => n + g._count._all, 0);
  const sum = groups.reduce((n, g) => n + g.rating * g._count._all, 0);
  return {
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    count,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: groups.find((g) => g.rating === rating)?._count._all ?? 0,
    })),
  };
}

const SORT: Record<string, Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }],
};

export async function listReviews(
  slug: string,
  q: z.output<typeof reviewListQuerySchema>,
): Promise<ReviewsPageDTO> {
  const product = await activeProduct(slug);
  const where: Prisma.ReviewWhereInput = {
    productId: product.id,
    isApproved: true,
    ...(q.rating ? { rating: q.rating } : {}),
  };
  const [rows, total, stats] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: [...SORT[q.sort]!, { id: "asc" }],
      ...skipTake(q),
    }),
    prisma.review.count({ where }),
    summary(product.id),
  ]);
  return {
    ...paginated(rows.map(toReview), { page: q.page, limit: q.limit, total }),
    summary: stats,
  };
}

/**
 * Only people who received the product may review it: a delivered order with
 * the product, placed from their account or with their verified email.
 */
async function hasReceived(userId: string, productId: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  const count = await prisma.order.count({
    where: {
      status: { in: RECEIVED },
      items: { some: { productId } },
      OR: [{ userId }, ...(user.emailVerified ? [{ email: user.email }] : [])],
    },
  });
  return count > 0;
}

export async function eligibility(slug: string, userId?: string): Promise<ReviewEligibilityDTO> {
  const product = await activeProduct(slug);
  if (!userId) return { canReview: false, reason: "sign_in", review: null };
  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
  });
  if (existing) return { canReview: true, reason: null, review: toMine(existing) };
  const received = await hasReceived(userId, product.id);
  return { canReview: received, reason: received ? null : "not_purchased", review: null };
}

/** Creates or updates the user's review. Edits go back into moderation (unless auto-approve is on). */
export async function saveReview(slug: string, userId: string, input: ReviewInput) {
  const product = await activeProduct(slug);
  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
  });
  if (!existing && !(await hasReceived(userId, product.id))) {
    throw AppError.forbidden("You can review products once your order has been delivered");
  }
  const autoApprove = await getSetting("reviews.autoApprove", false);
  const data = {
    rating: input.rating,
    title: input.title ?? null,
    body: input.body,
    isApproved: autoApprove,
  };
  const review = await prisma.review.upsert({
    where: { productId_userId: { productId: product.id, userId } },
    create: { ...data, productId: product.id, userId },
    update: data,
  });
  await refreshRating(product.id);
  return { review: toMine(review), created: !existing };
}

export async function deleteOwnReview(slug: string, userId: string) {
  const product = await activeProduct(slug);
  const { count } = await prisma.review.deleteMany({ where: { productId: product.id, userId } });
  if (!count) throw AppError.notFound("Review");
  await refreshRating(product.id);
}

// ───────────── Admin ─────────────

const adminInclude = {
  user: { select: { id: true, name: true, email: true } },
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
  },
} satisfies Prisma.ReviewInclude;

const toAdmin = (r: Prisma.ReviewGetPayload<{ include: typeof adminInclude }>): AdminReviewDTO => ({
  ...toMine(r),
  user: r.user,
  product: {
    id: r.product.id,
    title: r.product.title,
    slug: r.product.slug,
    image: r.product.images[0]?.url ?? null,
  },
});

export async function adminListReviews(q: z.output<typeof adminReviewListQuerySchema>) {
  const where: Prisma.ReviewWhereInput = {
    ...(q.status === "all" ? {} : { isApproved: q.status === "approved" }),
    ...(q.rating ? { rating: q.rating } : {}),
    ...(q.q
      ? {
          OR: [
            { title: { contains: q.q, mode: "insensitive" } },
            { body: { contains: q.q, mode: "insensitive" } },
            { product: { title: { contains: q.q, mode: "insensitive" } } },
            { user: { email: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: adminInclude,
      // Oldest pending first, so nothing waits forever; otherwise newest first.
      orderBy: { createdAt: q.status === "pending" ? "asc" : "desc" },
      ...skipTake(q),
    }),
    prisma.review.count({ where }),
  ]);
  return paginated(rows.map(toAdmin), { page: q.page, limit: q.limit, total });
}

export async function moderateReview(
  id: string,
  input: { isApproved?: boolean; adminReply?: string | null },
) {
  const current = await prisma.review.findUnique({ where: { id } });
  if (!current) throw AppError.notFound("Review");
  const review = await prisma.review.update({ where: { id }, data: input, include: adminInclude });
  if (input.isApproved !== undefined && input.isApproved !== current.isApproved) {
    await refreshRating(review.productId);
  }
  return toAdmin(review);
}

export async function adminDeleteReview(id: string) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw AppError.notFound("Review");
  await prisma.review.delete({ where: { id } });
  await refreshRating(review.productId);
  return review;
}
