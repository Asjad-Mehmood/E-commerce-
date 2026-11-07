import {
  adminReviewListQuerySchema,
  moderateReviewSchema,
  reviewListQuerySchema,
  reviewSchema,
} from "@hoodie/validation";
import { audit } from "../../lib/audit";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import * as reviews from "./reviews.service";

/** Mounted at /products alongside the catalog routes. */
export const productReviewsRouter = defineRoutes("/products", "Reviews", [
  route({
    method: "get",
    path: "/:slug/reviews",
    summary: "Approved reviews for a product, with the rating summary",
    access: "public",
    query: reviewListQuerySchema,
    handler: async ({ params, query }) => reviews.listReviews(params.slug!, query),
  }),
  route({
    method: "get",
    path: "/:slug/reviews/eligibility",
    summary: "Whether the signed-in customer can review this product, and their review",
    description: "Customers can review products from orders that were delivered to them.",
    access: "optional",
    handler: async ({ req, params }) => ok(await reviews.eligibility(params.slug!, req.user?.id)),
  }),
  route({
    method: "put",
    path: "/:slug/reviews",
    summary: "Write or update your review",
    description:
      "One review per customer per product. New and edited reviews wait for moderation unless auto-approve is on in store settings.",
    access: "user",
    rateLimit: "forms",
    body: reviewSchema,
    handler: async ({ req, params, body }) =>
      ok((await reviews.saveReview(params.slug!, currentUser(req).id, body)).review),
  }),
  route({
    method: "delete",
    path: "/:slug/reviews",
    summary: "Delete your review",
    access: "user",
    handler: async ({ req, params }) => {
      await reviews.deleteOwnReview(params.slug!, currentUser(req).id);
    },
  }),
]);

export const adminReviewsRouter = defineRoutes("/admin/reviews", "Admin: Reviews", [
  route({
    method: "get",
    path: "",
    summary: "Reviews to moderate (`status=pending|approved|all`)",
    access: "SUPPORT",
    query: adminReviewListQuerySchema,
    handler: ({ query }) => reviews.adminListReviews(query),
  }),
  route({
    method: "patch",
    path: "/:id",
    summary: "Approve or hide a review, and/or reply publicly",
    access: "SUPPORT",
    body: moderateReviewSchema,
    handler: async ({ req, params, body }) => {
      const review = await reviews.moderateReview(params.id!, body);
      await audit(req, "review.moderate", "Review", review.id, {
        product: review.product.title,
        ...body,
      });
      return ok(review);
    },
  }),
  route({
    method: "delete",
    path: "/:id",
    summary: "Delete a review (e.g. spam)",
    access: "MANAGER",
    handler: async ({ req, params }) => {
      const review = await reviews.adminDeleteReview(params.id!);
      await audit(req, "review.delete", "Review", review.id, { rating: review.rating });
    },
  }),
]);
