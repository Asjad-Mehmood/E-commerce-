import type {
  AuditLogEntryDTO,
  StaffMemberDTO,
  StoreSettingsDTO,
  StoreSettingsResponseDTO,
} from "@hoodie/types";
import { ADMIN_ROLES, ErrorCode } from "@hoodie/types";
import {
  auditLogQuerySchema,
  inviteStaffSchema,
  updateStaffSchema,
  updateStoreSettingsSchema,
} from "@hoodie/validation";
import type { Prisma, User } from "@prisma/client";
import { env } from "../../config/env";
import { audit } from "../../lib/audit";
import { dayRange } from "../../lib/dates";
import { ok, paginated, skipTake } from "../../lib/http";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { getSettings, storeTimeZone } from "../../lib/settings";
import { currentUser } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { staffInviteEmail } from "../auth/auth.emails";
import { issueToken } from "../auth/auth.service";
import { getPaymentProvider } from "../payments";
import { uploadProvider } from "./uploads.routes";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

const toStaff = (u: User): StaffMemberDTO => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role as StaffMemberDTO["role"],
  isBlocked: u.isBlocked,
  invitePending: u.passwordHash === null,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

async function findStaff(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === "CUSTOMER") throw AppError.notFound("Staff member");
  return user;
}

const revokeSessions = (userId: string) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

/*
 * Only Super Admins reach these routes, and nobody may change their own access,
 * so there is always at least one active Super Admin.
 */
function notSelf(req: Parameters<typeof currentUser>[0], id: string) {
  if (currentUser(req).id === id) {
    throw AppError.conflict("You can't change your own access. Ask another Super Admin.");
  }
}

export const adminStaffRouter = defineRoutes("/admin/staff", "Admin: Staff & settings", [
  route({
    method: "get",
    path: "",
    summary: "List staff accounts",
    access: "SUPER_ADMIN",
    handler: async () => {
      const staff = await prisma.user.findMany({
        where: { role: { in: [...ADMIN_ROLES] } },
        orderBy: [{ isBlocked: "asc" }, { createdAt: "asc" }],
      });
      return ok(staff.map(toStaff));
    },
  }),
  route({
    method: "post",
    path: "",
    summary: "Invite a staff member",
    description:
      "Creates the account and emails a link to choose a password (valid 72 hours). If the email already has a customer account, that account is given staff access instead.",
    access: "SUPER_ADMIN",
    body: inviteStaffSchema,
    status: 201,
    handler: async ({ req, body }) => {
      const inviter = currentUser(req);
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing && existing.role !== "CUSTOMER") {
        throw AppError.conflict("This person is already a staff member");
      }
      const user = existing
        ? await prisma.user.update({ where: { id: existing.id }, data: { role: body.role } })
        : await prisma.user.create({
            data: { email: body.email, name: body.name, role: body.role },
          });
      const token = user.passwordHash
        ? null
        : await issueToken(user.id, "PASSWORD_RESET", INVITE_TTL_MS);
      void sendMail(staffInviteEmail(user.email, user.name, body.role, inviter.name, token));
      await audit(req, "staff.invite", "User", user.id, {
        email: user.email,
        role: body.role,
        existingAccount: !!existing,
      });
      return ok(toStaff(user));
    },
  }),
  route({
    method: "post",
    path: "/:id/resend-invite",
    summary: "Send a new invitation link to someone who has not set a password yet",
    access: "SUPER_ADMIN",
    handler: async ({ req, params }) => {
      const user = await findStaff(params.id!);
      if (user.passwordHash) throw AppError.conflict("This person has already set a password");
      const token = await issueToken(user.id, "PASSWORD_RESET", INVITE_TTL_MS);
      void sendMail(
        staffInviteEmail(user.email, user.name, user.role, currentUser(req).name, token),
      );
      await audit(req, "staff.resend-invite", "User", user.id, { email: user.email });
      return ok(toStaff(user));
    },
  }),
  route({
    method: "patch",
    path: "/:id",
    summary: "Change a staff member's role, or deactivate / reactivate them",
    description: "Deactivating signs them out everywhere. You cannot change your own access.",
    access: "SUPER_ADMIN",
    body: updateStaffSchema,
    handler: async ({ req, params, body }) => {
      notSelf(req, params.id!);
      const before = await findStaff(params.id!);
      const user = await prisma.user.update({ where: { id: before.id }, data: body });
      if (body.isBlocked || (body.role && body.role !== before.role)) await revokeSessions(user.id);
      await audit(req, "staff.update", "User", user.id, {
        email: user.email,
        ...(body.role ? { role: { from: before.role, to: body.role } } : {}),
        ...(body.isBlocked !== undefined ? { isBlocked: body.isBlocked } : {}),
      });
      return ok(toStaff(user));
    },
  }),
  route({
    method: "delete",
    path: "/:id",
    summary: "Remove staff access (the account becomes a regular customer account)",
    access: "SUPER_ADMIN",
    handler: async ({ req, params }) => {
      notSelf(req, params.id!);
      const user = await findStaff(params.id!);
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { role: "CUSTOMER" } }),
        revokeSessions(user.id),
      ]);
      await audit(req, "staff.remove", "User", user.id, { email: user.email, role: user.role });
    },
  }),
]);

const SETTINGS_DEFAULTS: StoreSettingsDTO = {
  "store.name": "Hoodie Store",
  "store.email": "support@hoodie.local",
  "store.phone": "",
  "store.address": "",
  "tax.rate": 0,
  "tax.inclusive": true,
  "payments.card.enabled": true,
  "payments.cod.enabled": true,
  "returns.windowDays": 14,
  "reviews.autoApprove": false,
  "notifications.dailyDigest": true,
};

async function settingsResponse(): Promise<StoreSettingsResponseDTO> {
  const [settings, currency, timeZone] = await Promise.all([
    getSettings(SETTINGS_DEFAULTS),
    getSettings({ "store.currency": "PKR" }),
    storeTimeZone(),
  ]);
  return {
    settings,
    system: {
      currency: currency["store.currency"],
      timeZone,
      paymentProvider: getPaymentProvider()?.name ?? null,
      emailProvider: env.RESEND_API_KEY ? "resend" : "log",
      uploads: uploadProvider(),
    },
  };
}

export const adminSettingsRouter = defineRoutes("/admin/settings", "Admin: Staff & settings", [
  route({
    method: "get",
    path: "",
    summary: "Store settings, plus read-only facts about payments, email and uploads",
    access: "SUPER_ADMIN",
    handler: async () => ok(await settingsResponse()),
  }),
  route({
    method: "patch",
    path: "",
    summary: "Update store settings (only the keys sent change)",
    description: "At least one payment method must stay enabled.",
    access: "SUPER_ADMIN",
    body: updateStoreSettingsSchema,
    handler: async ({ req, body }) => {
      const current = await getSettings(SETTINGS_DEFAULTS);
      const next = { ...current, ...body };
      if (!next["payments.card.enabled"] && !next["payments.cod.enabled"]) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Keep at least one payment method on", {
          fieldErrors: { "payments.cod.enabled": ["Keep at least one payment method on"] },
        });
      }
      const changed = Object.entries(body).filter(
        ([key, value]) => current[key as keyof StoreSettingsDTO] !== value,
      );
      await prisma.$transaction(
        changed.map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            create: { key, value: value as Prisma.InputJsonValue },
            update: { value: value as Prisma.InputJsonValue },
          }),
        ),
      );
      if (changed.length) {
        await audit(
          req,
          "settings.update",
          "Setting",
          changed.map(([k]) => k).join(","),
          Object.fromEntries(
            changed.map(([key, value]) => [
              key,
              { from: current[key as keyof StoreSettingsDTO], to: value },
            ]),
          ) as Prisma.InputJsonValue,
        );
      }
      return ok(await settingsResponse());
    },
  }),
]);

export const adminAuditRouter = defineRoutes("/admin/audit-log", "Admin: Staff & settings", [
  route({
    method: "get",
    path: "",
    summary: "Who changed what, and when (newest first)",
    description: "`q` matches the action (e.g. `refund`) or the record id.",
    access: "SUPER_ADMIN",
    query: auditLogQuerySchema,
    handler: async ({ query }) => {
      const and: Prisma.AuditLogWhereInput[] = [];
      if (query.q) {
        and.push({
          OR: [
            { action: { contains: query.q, mode: "insensitive" } },
            { entityId: { contains: query.q } },
          ],
        });
      }
      if (query.entity) and.push({ entity: query.entity });
      if (query.adminId) and.push({ adminId: query.adminId });
      if (query.from || query.to) {
        const range = dayRange(await storeTimeZone(), query.from, query.to, 3650);
        and.push({ createdAt: { gte: range.start, lt: range.end } });
      }
      const where = { AND: and };
      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: { admin: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          ...skipTake(query),
        }),
        prisma.auditLog.count({ where }),
      ]);
      return paginated(
        rows.map((r): AuditLogEntryDTO => ({
          id: r.id,
          action: r.action,
          entity: r.entity,
          entityId: r.entityId,
          diff: r.diff,
          ip: r.ip,
          createdAt: r.createdAt.toISOString(),
          admin: r.admin,
        })),
        { page: query.page, limit: query.limit, total },
      );
    },
  }),
  route({
    method: "get",
    path: "/entities",
    summary: "The record types that appear in the audit log (for the filter menu)",
    access: "SUPER_ADMIN",
    handler: async () => {
      const rows = await prisma.auditLog.findMany({
        distinct: ["entity"],
        select: { entity: true },
        orderBy: { entity: "asc" },
      });
      return ok(rows.map((r) => r.entity));
    },
  }),
]);
