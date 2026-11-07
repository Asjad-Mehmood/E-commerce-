import { formatMoney } from "@hoodie/types";
import { env } from "../../config/env";
import { emailLayout, esc } from "../../lib/email-layout";
import { logger } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { unsubscribeLink } from "../../lib/signed";
import { effectivePrice } from "../catalog/catalog.mapper";

const HOUR = 60 * 60 * 1000;

/** When each reminder goes out, measured from the cart's last change. */
export const REMINDER_DELAYS = [1 * HOUR, 24 * HOUR];
/** Carts untouched for longer than this are left alone. */
const MAX_AGE = 7 * 24 * HOUR;

/**
 * Emails signed-in customers who left items in their cart: once after an hour,
 * once more after a day. Any change to the cart starts the clock again
 * (cart.service resets `remindersSent`). Skips customers who opted out, are
 * blocked, have ordered since, or whose items are no longer available.
 * Returns how many reminders were sent.
 */
export async function sendCartReminders(now = new Date()): Promise<number> {
  const due = await prisma.cart.findMany({
    where: {
      userId: { not: null },
      user: { cartReminders: true, isBlocked: false },
      items: { some: {} },
      updatedAt: { gte: new Date(now.getTime() - MAX_AGE) },
      OR: REMINDER_DELAYS.map((delay, i) => ({
        remindersSent: i,
        updatedAt: { lte: new Date(now.getTime() - delay) },
      })),
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: {
        include: {
          variant: {
            include: {
              product: {
                select: {
                  title: true,
                  status: true,
                  basePrice: true,
                  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
                },
              },
            },
          },
        },
      },
    },
    // Oldest first, so a backlog is worked through fairly over several runs.
    orderBy: { updatedAt: "asc" },
    take: 500,
  });

  let sent = 0;
  for (const cart of due) {
    const user = cart.user!;
    const available = cart.items.filter(
      (i) =>
        i.variant.isActive &&
        i.variant.product.status === "ACTIVE" &&
        i.variant.stock - i.variant.reserved > 0,
    );
    const orderedSince = await prisma.order.count({
      where: { userId: user.id, placedAt: { gte: cart.updatedAt } },
    });
    // Claim this reminder (keeping updatedAt, so the claim itself doesn't restart the clock).
    const { count } = await prisma.cart.updateMany({
      where: { id: cart.id, remindersSent: cart.remindersSent, updatedAt: cart.updatedAt },
      data: {
        remindersSent: available.length && !orderedSince ? cart.remindersSent + 1 : 2,
        lastReminderAt: now,
        updatedAt: cart.updatedAt,
      },
    });
    if (!count || !available.length || orderedSince) continue;

    const first = cart.remindersSent === 0;
    const lines = available.slice(0, 3);
    const url = `${env.STOREFRONT_URL}/cart`;
    const stop = unsubscribeLink("cart", user.email);
    const rows = lines
      .map((i) => {
        const price = effectivePrice(i.variant, i.variant.product.basePrice) * i.quantity;
        return `<tr><td style="padding:6px 0">${esc(i.variant.product.title)}<br><span style="color:#666;font-size:13px">${esc(i.variant.color)} · ${esc(i.variant.size)} × ${i.quantity}</span></td><td style="text-align:right;vertical-align:top;padding:6px 0">${formatMoney(price)}</td></tr>`;
      })
      .join("");
    const more =
      available.length > lines.length
        ? `<p style="color:#666">…and ${available.length - lines.length} more.</p>`
        : "";
    await sendMail({
      to: user.email,
      subject: first ? "You left something in your cart" : "Your cart is still waiting",
      text: `Hi ${user.name},\n\nYour cart still has ${available.length} item(s): ${lines.map((i) => i.variant.product.title).join(", ")}.\n${url}\n\nStop cart reminders: ${stop}\n`,
      html: emailLayout(
        first ? "Still thinking it over?" : "Your cart is still waiting",
        `<p>Hi ${esc(user.name)}, your cart still has these hoodies. Sizes sell out, so we can't hold them for long.</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #eee;border-bottom:1px solid #eee">${rows}</table>${more}`,
        { label: "Back to your cart", url },
        `<a href="${esc(stop)}" style="color:#888">Stop cart reminder emails</a>`,
      ),
    });
    sent++;
  }
  if (sent) logger.info(`Sent ${sent} cart reminder(s)`);
  return sent;
}
