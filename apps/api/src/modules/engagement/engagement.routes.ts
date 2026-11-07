import type { NewsletterSubscriberDTO } from "@hoodie/types";
import { newsletterListQuerySchema, unsubscribeSchema } from "@hoodie/validation";
import type { Prisma } from "@prisma/client";
import { sendCsv } from "../../lib/csv";
import { paginated, skipTake } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { verifySigned } from "../../lib/signed";
import { AppError } from "../../utils/app-error";

export const emailPreferencesRouter = defineRoutes("/email-preferences", "Content", [
  route({
    method: "post",
    path: "/unsubscribe",
    summary: "Unsubscribe from the newsletter or cart reminders (link from an email)",
    description:
      "`token` comes from the email's link and is tied to the address, so nobody can unsubscribe someone else. Always 204 for a valid link.",
    access: "public",
    rateLimit: "forms",
    body: unsubscribeSchema,
    handler: async ({ body }) => {
      if (!verifySigned(`unsubscribe-${body.type}`, body.email, body.token)) {
        throw AppError.badRequest("This unsubscribe link is invalid");
      }
      if (body.type === "newsletter") {
        await prisma.newsletterSubscriber.updateMany({
          where: { email: body.email, unsubscribedAt: null },
          data: { unsubscribedAt: new Date() },
        });
      } else {
        await prisma.user.updateMany({
          where: { email: body.email },
          data: { cartReminders: false },
        });
      }
    },
  }),
]);

export const adminNewsletterRouter = defineRoutes("/admin/newsletter", "Admin: Content", [
  route({
    method: "get",
    path: "",
    summary: "Newsletter subscribers (`format=csv` for a mailing-tool import)",
    access: "MANAGER",
    query: newsletterListQuerySchema,
    handler: async ({ query, res }) => {
      const where: Prisma.NewsletterSubscriberWhereInput = {
        unsubscribedAt: query.status === "active" ? null : { not: null },
        ...(query.q ? { email: { contains: query.q, mode: "insensitive" } } : {}),
      };
      if (query.format === "csv") {
        const rows = await prisma.newsletterSubscriber.findMany({
          where,
          orderBy: { createdAt: "asc" },
          take: 100_000,
        });
        sendCsv(
          res,
          `newsletter-${query.status}.csv`,
          ["Email", "Subscribed at (UTC)", "Unsubscribed at (UTC)"],
          rows.map((r) => [r.email, r.createdAt, r.unsubscribedAt]),
        );
        return;
      }
      const [rows, total, active] = await Promise.all([
        prisma.newsletterSubscriber.findMany({
          where,
          orderBy: { createdAt: "desc" },
          ...skipTake(query),
        }),
        prisma.newsletterSubscriber.count({ where }),
        prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
      ]);
      return {
        ...paginated(
          rows.map((r): NewsletterSubscriberDTO => ({
            id: r.id,
            email: r.email,
            createdAt: r.createdAt.toISOString(),
            unsubscribedAt: r.unsubscribedAt?.toISOString() ?? null,
          })),
          { page: query.page, limit: query.limit, total },
        ),
        activeCount: active,
      };
    },
  }),
]);
