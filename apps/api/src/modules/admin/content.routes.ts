import type { AdminBannerDTO, AdminFaqDTO, AdminPageDTO, AnnouncementDTO } from "@hoodie/types";
import {
  announcementSchema,
  createBannerSchema,
  createFaqSchema,
  createPageSchema,
  updateBannerSchema,
  updateFaqSchema,
  updatePageSchema,
} from "@hoodie/validation";
import type { Banner, Page } from "@prisma/client";
import { audit } from "../../lib/audit";
import { ok } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { getSettings } from "../../lib/settings";
import { AppError } from "../../utils/app-error";

/** Pages the storefront footer links to: they can be unpublished or edited, not deleted. */
export const SYSTEM_PAGES = ["shipping", "returns", "privacy", "terms"];

const toBanner = (b: Banner): AdminBannerDTO => ({
  id: b.id,
  title: b.title,
  subtitle: b.subtitle,
  imageUrl: b.imageUrl,
  link: b.link,
  ctaLabel: b.ctaLabel,
  position: b.position,
  isActive: b.isActive,
  startsAt: b.startsAt?.toISOString() ?? null,
  endsAt: b.endsAt?.toISOString() ?? null,
});

const toPage = (p: Page): AdminPageDTO => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  content: p.content,
  seoDescription: p.seoDescription,
  isPublished: p.isPublished,
  updatedAt: p.updatedAt.toISOString(),
});

const dates = (d: { startsAt?: string | null; endsAt?: string | null }) => ({
  ...(d.startsAt !== undefined ? { startsAt: d.startsAt ? new Date(d.startsAt) : null } : {}),
  ...(d.endsAt !== undefined ? { endsAt: d.endsAt ? new Date(d.endsAt) : null } : {}),
});

async function exists(check: Promise<unknown>, what: string) {
  if (!(await check)) throw AppError.notFound(what);
}

export const adminContentRouter = defineRoutes("/admin", "Admin: Content", [
  // Banners
  route({
    method: "get",
    path: "/banners",
    summary: "List homepage banners (all, including inactive and scheduled)",
    access: "MANAGER",
    handler: async () =>
      ok(
        (
          await prisma.banner.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] })
        ).map(toBanner),
      ),
  }),
  route({
    method: "post",
    path: "/banners",
    summary: "Create a homepage banner",
    access: "MANAGER",
    body: createBannerSchema,
    status: 201,
    handler: async ({ req, body }) => {
      const banner = await prisma.banner.create({ data: { ...body, ...dates(body) } });
      await audit(req, "banner.create", "Banner", banner.id, { title: banner.title });
      return ok(toBanner(banner));
    },
  }),
  route({
    method: "patch",
    path: "/banners/:id",
    summary: "Update a banner",
    access: "MANAGER",
    body: updateBannerSchema,
    handler: async ({ req, params, body }) => {
      const current = await prisma.banner.findUnique({ where: { id: params.id! } });
      if (!current) throw AppError.notFound("Banner");
      const startsAt =
        body.startsAt !== undefined ? body.startsAt : current.startsAt?.toISOString();
      const endsAt = body.endsAt !== undefined ? body.endsAt : current.endsAt?.toISOString();
      if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt))
        throw AppError.badRequest("The end must be after the start");
      const banner = await prisma.banner.update({
        where: { id: params.id! },
        data: { ...body, ...dates(body) },
      });
      await audit(req, "banner.update", "Banner", banner.id, body);
      return ok(toBanner(banner));
    },
  }),
  route({
    method: "delete",
    path: "/banners/:id",
    summary: "Delete a banner",
    access: "MANAGER",
    handler: async ({ req, params }) => {
      const { count } = await prisma.banner.deleteMany({ where: { id: params.id! } });
      if (!count) throw AppError.notFound("Banner");
      await audit(req, "banner.delete", "Banner", params.id!);
    },
  }),

  // Pages
  route({
    method: "get",
    path: "/pages",
    summary: "List content pages",
    access: "MANAGER",
    handler: async () =>
      ok((await prisma.page.findMany({ orderBy: { title: "asc" } })).map(toPage)),
  }),
  route({
    method: "post",
    path: "/pages",
    summary: "Create a content page (shown at /policies/{slug})",
    access: "MANAGER",
    body: createPageSchema,
    status: 201,
    handler: async ({ req, body }) => {
      if (await prisma.page.findUnique({ where: { slug: body.slug } }))
        throw AppError.conflict("A page with this slug already exists");
      const page = await prisma.page.create({ data: body });
      await audit(req, "page.create", "Page", page.id, { slug: page.slug });
      return ok(toPage(page));
    },
  }),
  route({
    method: "patch",
    path: "/pages/:id",
    summary: "Update a content page",
    description: "The slugs of the shipping, returns, privacy and terms pages cannot change.",
    access: "MANAGER",
    body: updatePageSchema,
    handler: async ({ req, params, body }) => {
      const current = await prisma.page.findUnique({ where: { id: params.id! } });
      if (!current) throw AppError.notFound("Page");
      if (body.slug && body.slug !== current.slug) {
        if (SYSTEM_PAGES.includes(current.slug))
          throw AppError.conflict("The storefront links to this page, so its slug can't change");
        if (await prisma.page.findUnique({ where: { slug: body.slug } }))
          throw AppError.conflict("A page with this slug already exists");
      }
      const page = await prisma.page.update({ where: { id: params.id! }, data: body });
      await audit(req, "page.update", "Page", page.id, {
        slug: page.slug,
        fields: Object.keys(body),
      });
      return ok(toPage(page));
    },
  }),
  route({
    method: "delete",
    path: "/pages/:id",
    summary: "Delete a content page (not the shipping, returns, privacy or terms pages)",
    access: "MANAGER",
    handler: async ({ req, params }) => {
      const page = await prisma.page.findUnique({ where: { id: params.id! } });
      if (!page) throw AppError.notFound("Page");
      if (SYSTEM_PAGES.includes(page.slug))
        throw AppError.conflict("The storefront links to this page. Unpublish it instead.");
      await prisma.page.delete({ where: { id: page.id } });
      await audit(req, "page.delete", "Page", page.id, { slug: page.slug });
    },
  }),

  // FAQ
  route({
    method: "get",
    path: "/faq",
    summary: "List FAQ entries",
    access: "MANAGER",
    handler: async () =>
      ok<AdminFaqDTO[]>(
        await prisma.faq.findMany({ orderBy: [{ position: "asc" }, { question: "asc" }] }),
      ),
  }),
  route({
    method: "post",
    path: "/faq",
    summary: "Create an FAQ entry",
    access: "MANAGER",
    body: createFaqSchema,
    status: 201,
    handler: async ({ req, body }) => {
      const faq = await prisma.faq.create({ data: body });
      await audit(req, "faq.create", "Faq", faq.id, { question: faq.question });
      return ok<AdminFaqDTO>(faq);
    },
  }),
  route({
    method: "patch",
    path: "/faq/:id",
    summary: "Update an FAQ entry",
    access: "MANAGER",
    body: updateFaqSchema,
    handler: async ({ req, params, body }) => {
      await exists(prisma.faq.findUnique({ where: { id: params.id! } }), "FAQ entry");
      const faq = await prisma.faq.update({ where: { id: params.id! }, data: body });
      await audit(req, "faq.update", "Faq", faq.id, body);
      return ok<AdminFaqDTO>(faq);
    },
  }),
  route({
    method: "delete",
    path: "/faq/:id",
    summary: "Delete an FAQ entry",
    access: "MANAGER",
    handler: async ({ req, params }) => {
      const { count } = await prisma.faq.deleteMany({ where: { id: params.id! } });
      if (!count) throw AppError.notFound("FAQ entry");
      await audit(req, "faq.delete", "Faq", params.id!);
    },
  }),

  // Announcement bar
  route({
    method: "get",
    path: "/announcement",
    summary: "The announcement bar shown above the storefront header",
    access: "MANAGER",
    handler: async () => {
      const s = await getSettings({ "announcement.enabled": false, "announcement.text": "" });
      return ok<AnnouncementDTO>({
        enabled: s["announcement.enabled"],
        text: s["announcement.text"],
      });
    },
  }),
  route({
    method: "put",
    path: "/announcement",
    summary: "Update the announcement bar",
    access: "MANAGER",
    body: announcementSchema,
    handler: async ({ req, body }) => {
      if (body.enabled && !body.text)
        throw AppError.badRequest("Write the announcement text first");
      await prisma.$transaction([
        prisma.setting.upsert({
          where: { key: "announcement.enabled" },
          create: { key: "announcement.enabled", value: body.enabled },
          update: { value: body.enabled },
        }),
        prisma.setting.upsert({
          where: { key: "announcement.text" },
          create: { key: "announcement.text", value: body.text },
          update: { value: body.text },
        }),
      ]);
      await audit(req, "announcement.update", "Setting", "announcement", body);
      return ok<AnnouncementDTO>(body);
    },
  }),
]);
