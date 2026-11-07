import { formatMoney } from "@hoodie/types";
import { env } from "../../config/env";
import { addDays, dayOf, startOfDay } from "../../lib/dates";
import { emailLayout, esc } from "../../lib/email-layout";
import { logger } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { getSetting, storeTimeZone } from "../../lib/settings";
import { lowStockCount } from "../admin/inventory.service";
import { productReport, totalsBetween } from "../admin/reports.service";

/**
 * Morning summary for managers and Super Admins: yesterday's sales and what
 * needs attention today. Sent at 08:00 store time by the job scheduler.
 * Switch it off in Store settings (notifications.dailyDigest).
 */
export async function sendDailyDigest(now = new Date()): Promise<number> {
  if (!(await getSetting("notifications.dailyDigest", true))) return 0;
  const recipients = await prisma.user.findMany({
    where: { role: { in: ["MANAGER", "SUPER_ADMIN"] }, isBlocked: false },
    select: { email: true },
  });
  if (!recipients.length) return 0;

  const zone = await storeTimeZone();
  const yesterday = addDays(dayOf(now, zone), -1);
  const start = startOfDay(yesterday, zone);
  const end = startOfDay(addDays(yesterday, 1), zone);
  const [totals, top, toFulfil, returns, reviews, messages, low] = await Promise.all([
    totalsBetween(start, end, zone),
    productReport({ from: yesterday, to: yesterday }, 3),
    prisma.order.count({ where: { status: { in: ["CONFIRMED", "PAID", "PROCESSING"] } } }),
    prisma.returnRequest.count({ where: { status: "REQUESTED" } }),
    prisma.review.count({ where: { isApproved: false } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    lowStockCount(),
  ]);

  const aov = totals.orders ? Math.round(totals.net / totals.orders) : 0;
  const line = (label: string, value: string) =>
    `<tr><td style="padding:4px 0;color:#555">${label}</td><td style="text-align:right;padding:4px 0;font-weight:600">${value}</td></tr>`;
  const todo = [
    [toFulfil, "orders to fulfil"],
    [returns, "return requests to review"],
    [reviews, "reviews to moderate"],
    [messages, "new messages"],
    [low, "variants low on stock"],
  ].filter(([n]) => (n as number) > 0) as [number, string][];
  const dateLabel = new Date(`${yesterday}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  const body = `<p>Here's how ${esc(dateLabel)} went.</p>
<table role="presentation" style="width:100%;border-collapse:collapse;margin:12px 0">
${line("Net sales", formatMoney(totals.net))}
${line("Orders", String(totals.orders))}
${line("Average order", formatMoney(aov))}
${totals.refunds ? line("Refunds", formatMoney(totals.refunds)) : ""}
</table>
${top.length ? `<p style="margin-bottom:4px"><strong>Best sellers</strong></p><ol style="margin-top:0;padding-left:20px">${top.map((p) => `<li>${esc(p.title)}: ${p.units} sold</li>`).join("")}</ol>` : ""}
${todo.length ? `<p style="margin-bottom:4px"><strong>Needs attention</strong></p><ul style="margin-top:0;padding-left:20px">${todo.map(([n, t]) => `<li>${n} ${t}</li>`).join("")}</ul>` : "<p>Nothing needs your attention today.</p>"}`;

  for (const r of recipients) {
    await sendMail({
      to: r.email,
      subject: `Yesterday: ${formatMoney(totals.net)} from ${totals.orders} order(s)`,
      text: `${dateLabel}: net sales ${formatMoney(totals.net)}, ${totals.orders} order(s).\n${todo.map(([n, t]) => `${n} ${t}`).join("\n")}\n${env.ADMIN_URL}\n`,
      html: emailLayout(
        "Your daily summary",
        body,
        { label: "Open the dashboard", url: env.ADMIN_URL },
        "Turn this email off in the admin under Store settings.",
      ),
    });
  }
  logger.info(`Daily summary sent to ${recipients.length} staff member(s)`);
  return recipients.length;
}
