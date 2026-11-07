import type {
  AuditLogEntryDTO,
  EmailSettingsDTO,
  StaffMemberDTO,
  StoreSettingsDTO,
  StoreSettingsResponseDTO,
} from "@hoodie/types";
import { ADMIN_ROLES, ErrorCode } from "@hoodie/types";
import {
  auditLogQuerySchema,
  emailSettingsSchema,
  testEmailSchema,
  inviteStaffSchema,
  updateStaffSchema,
  updateStoreSettingsSchema,
} from "@hoodie/validation";
import type { Prisma, User } from "@prisma/client";
import { env } from "../../config/env";
import { audit } from "../../lib/audit";
import { dayRange } from "../../lib/dates";
import { ok, paginated, skipTake } from "../../lib/http";
import {
  clearEmailConfigCache,
  emailEnabled,
  loadEmailConfig,
  readEmailSettings,
  toEmailConfig,
} from "../../lib/email-config";
import { sendMail, sendWith } from "../../lib/mailer";
import { decryptSecret, encryptSecret } from "../../lib/secrets";
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

/**
 * While email isn't set up the invitation can't be emailed, so the Super Admin
 * gets the set-password link to pass on themselves (WhatsApp, in person...).
 */
async function inviteLinkIfNoEmail(token: string | null) {
  if (!token || (await emailEnabled())) return {};
  return { inviteLink: `${env.ADMIN_URL}/set-password?token=${encodeURIComponent(token)}` };
}

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
      const link = await inviteLinkIfNoEmail(token);
      await audit(req, "staff.invite", "User", user.id, {
        email: user.email,
        role: body.role,
        existingAccount: !!existing,
      });
      return ok({ ...toStaff(user), ...link });
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
      return ok({ ...toStaff(user), ...(await inviteLinkIfNoEmail(token)) });
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
  "store.name": "Urban Store",
  "store.email": "support@urbanstore.pk",
  "store.phone": "",
  "store.address": "",
  "tax.rate": 0,
  "tax.inclusive": true,
  "payments.card.enabled": false,
  "payments.cod.enabled": true,
  "returns.windowDays": 14,
  "reviews.autoApprove": false,
  "notifications.dailyDigest": true,
};

async function emailSettingsResponse(): Promise<EmailSettingsDTO> {
  const s = await readEmailSettings();
  const config = toEmailConfig(s);
  const provider =
    s["email.provider"] === "smtp" || s["email.provider"] === "resend"
      ? s["email.provider"]
      : "none";
  return {
    provider,
    from: typeof s["email.from"] === "string" ? s["email.from"] : env.EMAIL_FROM,
    smtp: {
      host: typeof s["email.smtp.host"] === "string" ? s["email.smtp.host"] : "",
      port: Number(s["email.smtp.port"]) || 587,
      secure: s["email.smtp.secure"] === true,
      user: typeof s["email.smtp.user"] === "string" ? s["email.smtp.user"] : "",
      hasPassword: decryptSecret(s["email.smtp.password"]) !== null,
    },
    hasResendKey: decryptSecret(s["email.resend.apiKey"]) !== null,
    configured: config !== null,
    source: config ? (s["email.provider"] === undefined ? "environment" : "settings") : null,
  };
}

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
      emailProvider: (await loadEmailConfig())?.provider ?? null,
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
      if (
        body["payments.card.enabled"] &&
        !current["payments.card.enabled"] &&
        !getPaymentProvider()
      ) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Card payments need Stripe keys on the server first",
          {
            fieldErrors: {
              "payments.card.enabled": ["Card payments need Stripe keys on the server first"],
            },
          },
        );
      }
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
  route({
    method: "get",
    path: "/email",
    summary: "How emails are sent (passwords and API keys are never returned)",
    access: "SUPER_ADMIN",
    handler: async () => ok(await emailSettingsResponse()),
  }),
  route({
    method: "put",
    path: "/email",
    summary: "Set up email: SMTP (e.g. Gmail) or Resend, or turn it off",
    description:
      "Until this is set up, the store sends no email at all. Leave `password` / `apiKey` out to keep the saved one. Secrets are stored encrypted.",
    access: "SUPER_ADMIN",
    body: emailSettingsSchema,
    handler: async ({ req, body }) => {
      const current = await readEmailSettings();
      const values: Record<string, Prisma.InputJsonValue> = { "email.provider": body.provider };
      if (body.provider === "smtp") {
        if (!body.password && decryptSecret(current["email.smtp.password"]) === null) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, "Enter the SMTP password", {
            fieldErrors: { password: ["Enter the SMTP password"] },
          });
        }
        Object.assign(values, {
          "email.from": body.from,
          "email.smtp.host": body.host,
          "email.smtp.port": body.port,
          "email.smtp.secure": body.secure,
          "email.smtp.user": body.user,
          ...(body.password ? { "email.smtp.password": encryptSecret(body.password) } : {}),
        });
      } else if (body.provider === "resend") {
        if (!body.apiKey && decryptSecret(current["email.resend.apiKey"]) === null) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, "Enter the Resend API key", {
            fieldErrors: { apiKey: ["Enter the Resend API key"] },
          });
        }
        Object.assign(values, {
          "email.from": body.from,
          ...(body.apiKey ? { "email.resend.apiKey": encryptSecret(body.apiKey) } : {}),
        });
      }
      await prisma.$transaction(
        Object.entries(values).map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          }),
        ),
      );
      clearEmailConfigCache();
      await audit(req, "settings.email", "Setting", "email", {
        provider: body.provider,
        ...(body.provider === "smtp"
          ? { host: body.host, port: body.port, user: body.user, passwordChanged: !!body.password }
          : body.provider === "resend"
            ? { apiKeyChanged: !!body.apiKey }
            : {}),
      });
      return ok(await emailSettingsResponse());
    },
  }),
  route({
    method: "post",
    path: "/email/test",
    summary: "Send a test email with the saved settings",
    access: "SUPER_ADMIN",
    rateLimit: "forms",
    body: testEmailSchema,
    handler: async ({ body }) => {
      const config = toEmailConfig(await readEmailSettings());
      if (!config) throw AppError.conflict("Save your email settings first");
      try {
        await sendWith(config, {
          to: body.to,
          subject: "Test email from your store",
          text: "Email is working. Order confirmations and other emails will now be sent.",
          html: "<p>Email is working. Order confirmations and other emails will now be sent.</p>",
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message.slice(0, 300) : "unknown error";
        throw new AppError(
          ErrorCode.SERVICE_UNAVAILABLE,
          `The test email could not be sent: ${reason}`,
          undefined,
          502,
        );
      }
      return ok({ sent: true });
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
