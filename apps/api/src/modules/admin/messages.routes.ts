import type { ContactMessageDTO } from "@hoodie/types";
import {
  messageListQuerySchema,
  replyMessageSchema,
  updateMessageSchema,
} from "@hoodie/validation";
import type { ContactMessage, Prisma } from "@prisma/client";
import { isTest } from "../../config/env";
import { audit } from "../../lib/audit";
import { emailEnabled } from "../../lib/email-config";
import { emailLayout, esc } from "../../lib/email-layout";
import { ok, paginated, skipTake } from "../../lib/http";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { storeInfo } from "../../lib/settings";
import { AppError } from "../../utils/app-error";

const toDTO = (m: ContactMessage): ContactMessageDTO => ({
  id: m.id,
  name: m.name,
  email: m.email,
  subject: m.subject,
  message: m.message,
  status: m.status,
  createdAt: m.createdAt.toISOString(),
});

async function findMessage(id: string) {
  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) throw AppError.notFound("Message");
  return message;
}

export const adminMessagesRouter = defineRoutes("/admin/messages", "Admin: Messages", [
  route({
    method: "get",
    path: "",
    summary: "Contact form messages, newest first (archived ones only when asked for)",
    access: "SUPPORT",
    query: messageListQuerySchema,
    handler: async ({ query }) => {
      const where: Prisma.ContactMessageWhereInput = {
        status: query.status ?? { not: "ARCHIVED" },
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { email: { contains: query.q, mode: "insensitive" } },
                { subject: { contains: query.q, mode: "insensitive" } },
                { message: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.contactMessage.findMany({
          where,
          orderBy: { createdAt: "desc" },
          ...skipTake(query),
        }),
        prisma.contactMessage.count({ where }),
      ]);
      return paginated(rows.map(toDTO), { page: query.page, limit: query.limit, total });
    },
  }),
  route({
    method: "patch",
    path: "/:id",
    summary: "Mark a message as read, replied or archived",
    access: "SUPPORT",
    body: updateMessageSchema,
    handler: async ({ params, body }) => {
      await findMessage(params.id!);
      return ok(
        toDTO(await prisma.contactMessage.update({ where: { id: params.id! }, data: body })),
      );
    },
  }),
  route({
    method: "post",
    path: "/:id/reply",
    summary: "Email a reply to the sender and mark the message replied",
    access: "SUPPORT",
    body: replyMessageSchema,
    handler: async ({ req, params, body }) => {
      const message = await findMessage(params.id!);
      if (!isTest && !(await emailEnabled())) {
        throw AppError.conflict(
          "Email isn't set up yet, so replies can't be sent. Set it up in Store settings → Email, or reply from your own inbox.",
        );
      }
      const store = await storeInfo();
      const subject = `Re: ${message.subject || `Your message to ${store.name}`}`;
      const quoted = message.message
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
      await sendMail({
        to: message.email,
        subject,
        text: `Hi ${message.name},\n\n${body.body}\n\n${store.name}\n\n${quoted}\n`,
        html: emailLayout(
          subject,
          `<p>Hi ${esc(message.name)},</p><p style="white-space:pre-line">${esc(body.body)}</p><p>${esc(store.name)}</p><blockquote style="margin:16px 0 0;padding-left:12px;border-left:3px solid #ddd;color:#666;white-space:pre-line">${esc(message.message)}</blockquote>`,
        ),
      });
      const updated = await prisma.contactMessage.update({
        where: { id: message.id },
        data: { status: "REPLIED" },
      });
      await audit(req, "message.reply", "ContactMessage", message.id, { to: message.email });
      return ok(toDTO(updated));
    },
  }),
]);
