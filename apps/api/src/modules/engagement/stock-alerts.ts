import { emailLayout, esc } from "../../lib/email-layout";
import { logger } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";

/**
 * Call after stock goes up (restock, cancellation, return). Queues the
 * back-in-stock emails only if someone is actually waiting for these variants.
 */
export async function afterStockIncrease(variantIds: (string | null | undefined)[]) {
  const ids = [...new Set(variantIds.filter((id): id is string => !!id))];
  if (!ids.length) return;
  try {
    const waiting = await prisma.stockAlert.count({
      where: { variantId: { in: ids }, notifiedAt: null },
    });
    if (!waiting) return;
    const { enqueue } = await import("../../jobs/queue");
    await enqueue("stock-alerts", { variantIds: ids });
  } catch (err) {
    logger.error({ err, ids }, "Could not queue back-in-stock emails");
  }
}

/**
 * Emails everyone waiting for a variant that can be bought again. Each alert is
 * claimed before its email is sent, so nobody gets the same email twice.
 * Returns how many emails were sent.
 */
export async function notifyBackInStock(variantIds: string[]): Promise<number> {
  let sent = 0;
  for (const variantId of variantIds) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            title: true,
            slug: true,
            status: true,
            images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          },
        },
      },
    });
    if (
      !variant ||
      !variant.isActive ||
      variant.product.status !== "ACTIVE" ||
      variant.stock - variant.reserved <= 0
    ) {
      continue;
    }

    const alerts = await prisma.stockAlert.findMany({
      where: { variantId, notifiedAt: null },
      take: 500,
    });
    for (const alert of alerts) {
      const { count } = await prisma.stockAlert.updateMany({
        where: { id: alert.id, notifiedAt: null },
        data: { notifiedAt: new Date() },
      });
      if (!count) continue;
      const url = `${env.STOREFRONT_URL}/products/${variant.product.slug}`;
      const name = `${variant.product.title} (${variant.color}, ${variant.size})`;
      await sendMail({
        to: alert.email,
        subject: `Back in stock: ${variant.product.title}`,
        text: `Good news: ${name} is back in stock. Popular sizes sell out fast.\n${url}\n`,
        html: emailLayout(
          "It's back in stock",
          `<p>Good news: <strong>${esc(name)}</strong> is back in stock. Popular sizes sell out fast.</p>`,
          { label: "Shop now", url },
        ),
      });
      sent++;
    }
  }
  if (sent) logger.info(`Sent ${sent} back-in-stock email(s)`);
  return sent;
}
