import { addressSchema, updateProfileSchema, type AddressInput } from "@hoodie/validation";
import { ok } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { currentUser } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { toAuthUser } from "../auth/auth.service";

const MAX_ADDRESSES = 10;

const addressSelect = {
  id: true,
  fullName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefault: true,
} as const;

async function findOwnAddress(userId: string, id: string) {
  const address = await prisma.address.findFirst({ where: { id, userId }, select: addressSelect });
  if (!address) throw AppError.notFound("Address");
  return address;
}

/** Creates or updates an address. Making it the default clears the previous default. */
function saveAddress(userId: string, id: string | null, data: AddressInput) {
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, ...(id ? { id: { not: id } } : {}) },
        data: { isDefault: false },
      });
    }
    return id
      ? tx.address.update({ where: { id }, data, select: addressSelect })
      : tx.address.create({ data: { ...data, userId }, select: addressSelect });
  });
}

export const accountRouter = defineRoutes("/me", "Account", [
  route({
    method: "patch",
    path: "",
    summary: "Update profile (name, phone)",
    access: "user",
    body: updateProfileSchema,
    handler: async ({ req, body }) =>
      ok(toAuthUser(await prisma.user.update({ where: { id: currentUser(req).id }, data: body }))),
  }),
  route({
    method: "get",
    path: "/addresses",
    summary: "List saved addresses (default first)",
    access: "user",
    handler: async ({ req }) =>
      ok(
        await prisma.address.findMany({
          where: { userId: currentUser(req).id },
          select: addressSelect,
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        }),
      ),
  }),
  route({
    method: "post",
    path: "/addresses",
    summary: "Add an address",
    description: "The first address becomes the default automatically.",
    access: "user",
    body: addressSchema,
    status: 201,
    handler: async ({ req, body }) => {
      const userId = currentUser(req).id;
      const count = await prisma.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES)
        throw AppError.badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);
      const isDefault = body.isDefault || count === 0;
      return ok(await saveAddress(userId, null, { ...body, isDefault }));
    },
  }),
  route({
    method: "put",
    path: "/addresses/:id",
    summary: "Replace an address",
    access: "user",
    body: addressSchema,
    handler: async ({ req, body, params }) => {
      const userId = currentUser(req).id;
      const existing = await findOwnAddress(userId, params.id!);
      // The default address can only stop being default by making another one default.
      const isDefault = body.isDefault || existing.isDefault;
      return ok(await saveAddress(userId, existing.id, { ...body, isDefault }));
    },
  }),
  route({
    method: "delete",
    path: "/addresses/:id",
    summary: "Delete an address",
    description:
      "If the default address is deleted, the oldest remaining address becomes the default.",
    access: "user",
    handler: async ({ req, params }) => {
      const userId = currentUser(req).id;
      const existing = await findOwnAddress(userId, params.id!);
      await prisma.address.delete({ where: { id: existing.id } });
      if (existing.isDefault) {
        const next = await prisma.address.findFirst({
          where: { userId },
          orderBy: { createdAt: "asc" },
        });
        if (next)
          await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    },
  }),
]);
