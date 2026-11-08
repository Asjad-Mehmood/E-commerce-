import { env, isTest } from "../../config/env";
import { emailEnabled } from "../../lib/email-config";
import { emailLayout, esc } from "../../lib/email-layout";
import { logger } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";

const DAY = 24 * 60 * 60 * 1000;
/** Ask for a review this long after delivery… */
export const REVIEW_REQUEST_AFTER_MS = 7 * DAY;
/** …but not for orders delivered longer ago than this (e.g. when email is set up later). */
const REVIEW_REQUEST_WINDOW_MS = 30 * DAY;

/**
 * Sends the review request for every order delivered at least a week ago
 * that hasn't had one yet. Runs on a schedule; each order is claimed first
 * (reviewRequestedAt) so it is asked once even with several workers. Does
 * nothing while email isn't set up, so those orders are asked once it is.
 */
export async function sendDueReviewRequests(now = new Date()): Promise<number> {
  if (!isTest && !(await emailEnabled())) return 0;
  const due = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      reviewRequestedAt: null,
      deliveredAt: {
        lte: new Date(now.getTime() - REVIEW_REQUEST_AFTER_MS),
        gte: new Date(now.getTime() - REVIEW_REQUEST_WINDOW_MS),
      },
    },
    select: { id: true },
    orderBy: { deliveredAt: "asc" },
    take: 200,
  });
  let sent = 0;
  for (const { id } of due) {
    const claimed = await prisma.order.updateMany({
      where: { id, reviewRequestedAt: null },
      data: { reviewRequestedAt: now },
    });
    if (!claimed.count) continue;
    try {
      sent += await sendReviewRequest(id);
    } catch (err) {
      logger.error({ err, orderId: id }, "Review request failed");
    }
  }
  return sent;
}

/**
 * "How's your hoodie?" email, a week after delivery. Only for orders that are
 * still delivered (not returned or refunded), and only lists products the
 * customer hasn't reviewed yet. Returns 1 if an email was sent.
 */
export async function sendReviewRequest(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { id: true, name: true } } },
  });
  if (!order || order.status !== "DELIVERED") return 0;

  const reviewer = order.user ?? (await prisma.user.findUnique({ where: { email: order.email } }));
  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const reviewed = reviewer
    ? await prisma.review.findMany({
        where: { userId: reviewer.id, productId: { in: productIds } },
        select: { productId: true },
      })
    : [];
  const todo = order.items.filter(
    (item, i, all) =>
      !reviewed.some((r) => r.productId === item.productId) &&
      all.findIndex((x) => x.productId === item.productId) === i,
  );
  const live = await prisma.product.findMany({
    where: { id: { in: todo.map((i) => i.productId) }, status: "ACTIVE" },
    select: { id: true, slug: true },
  });
  const items = todo.filter((i) => live.some((p) => p.id === i.productId));
  if (!items.length) return 0;

  const link = (slug: string) => `${env.STOREFRONT_URL}/products/${slug}#reviews`;
  const first = live.find((p) => p.id === items[0]!.productId)!;
  const list = items
    .map((i) => {
      const slug = live.find((p) => p.id === i.productId)!.slug;
      return `<li style="margin:6px 0"><a href="${esc(link(slug))}" style="color:#111">${esc(i.productTitle)}</a></li>`;
    })
    .join("");
  const name = (order.user?.name ?? reviewer?.name ?? "").split(" ")[0];
  await sendMail({
    to: order.email,
    subject: `How's your ${items.length === 1 ? items[0]!.productTitle : "order"}?`,
    text: `${name ? `Hi ${name},\n\n` : ""}How are you finding your order ${order.orderNumber}? A quick review helps other shoppers pick the right hoodie and size.\n${items.map((i) => `- ${i.productTitle}: ${link(live.find((p) => p.id === i.productId)!.slug)}`).join("\n")}\n${reviewer ? "" : "\nReviews need an account with this email address.\n"}`,
    html: emailLayout(
      "How's your hoodie?",
      `<p>${name ? `Hi ${esc(name)}, h` : "H"}ow are you finding your order ${esc(order.orderNumber)}? A quick review helps other shoppers pick the right hoodie and size.</p><ul style="padding-left:20px">${list}</ul>${reviewer ? "" : `<p style="color:#555">Reviews need an account with this email address. <a href="${esc(env.STOREFRONT_URL)}/register" style="color:#111">Create one in a minute.</a></p>`}`,
      { label: "Write a review", url: link(first.slug) },
    ),
  });
  return 1;
}
