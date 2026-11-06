import { ErrorCode, type CouponDTO, type ShippingZoneDTO } from "@hoodie/types";
import type {
  CreateCouponInput,
  CreateShippingZoneInput,
  UpdateCouponInput,
  UpdateShippingZoneInput,
} from "@hoodie/validation";
import type { Coupon, ShippingZone } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";

// ───────────── Coupons ─────────────

export function couponState(c: Coupon, now = new Date()): CouponDTO["state"] {
  if (!c.isActive) return "disabled";
  if (c.endsAt && c.endsAt <= now) return "expired";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return "used_up";
  return "active";
}

export const toCouponDTO = (c: Coupon): CouponDTO => ({
  id: c.id,
  code: c.code,
  description: c.description,
  type: c.type,
  value: c.value,
  minOrderAmount: c.minOrderAmount,
  maxUses: c.maxUses,
  maxUsesPerUser: c.maxUsesPerUser,
  usedCount: c.usedCount,
  startsAt: c.startsAt?.toISOString() ?? null,
  endsAt: c.endsAt?.toISOString() ?? null,
  isActive: c.isActive,
  state: couponState(c),
  createdAt: c.createdAt.toISOString(),
});

const dates = (d: { startsAt?: string | null; endsAt?: string | null }) => ({
  ...(d.startsAt !== undefined ? { startsAt: d.startsAt ? new Date(d.startsAt) : null } : {}),
  ...(d.endsAt !== undefined ? { endsAt: d.endsAt ? new Date(d.endsAt) : null } : {}),
});

const codeTaken = async (code: string, exceptId?: string) =>
  (await prisma.coupon.count({
    where: { code, ...(exceptId ? { id: { not: exceptId } } : {}) },
  })) > 0;

export async function listCoupons(): Promise<CouponDTO[]> {
  const rows = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toCouponDTO);
}

export async function createCoupon(input: CreateCouponInput): Promise<CouponDTO> {
  if (await codeTaken(input.code)) throw AppError.conflict(`The code ${input.code} already exists`);
  const coupon = await prisma.coupon.create({
    data: {
      ...input,
      value: input.type === "FREE_SHIPPING" ? 0 : input.value,
      ...dates(input),
    },
  });
  return toCouponDTO(coupon);
}

function invalid(field: string, message: string): never {
  throw new AppError(ErrorCode.VALIDATION_ERROR, message, { fieldErrors: { [field]: [message] } });
}

export async function updateCoupon(id: string, input: UpdateCouponInput): Promise<CouponDTO> {
  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current) throw AppError.notFound("Coupon");
  if (input.code && (await codeTaken(input.code, id)))
    throw AppError.conflict(`The code ${input.code} already exists`);

  // Validate the combination that will be stored, not just the fields sent.
  const type = input.type ?? current.type;
  const value = input.value ?? current.value;
  if (type === "PERCENTAGE" && (value < 1 || value > 100))
    invalid("value", "Percentage must be between 1 and 100");
  if (type === "FIXED" && value <= 0) invalid("value", "Enter an amount above zero");
  const startsAt = input.startsAt !== undefined ? input.startsAt : current.startsAt?.toISOString();
  const endsAt = input.endsAt !== undefined ? input.endsAt : current.endsAt?.toISOString();
  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt))
    invalid("endsAt", "The end must be after the start");

  const coupon = await prisma.coupon.update({
    where: { id },
    data: { ...input, ...(type === "FREE_SHIPPING" ? { value: 0 } : {}), ...dates(input) },
  });
  return toCouponDTO(coupon);
}

/** Coupons that were used on orders are kept for the record; disable them instead. */
export async function deleteCoupon(id: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { _count: { select: { orders: true } } },
  });
  if (!coupon) throw AppError.notFound("Coupon");
  if (coupon._count.orders > 0) {
    throw AppError.conflict(
      "This coupon was used on orders, so it can't be deleted. Disable it instead.",
    );
  }
  await prisma.coupon.delete({ where: { id } });
}

// ───────────── Shipping zones ─────────────

export const toZoneDTO = (z: ShippingZone): ShippingZoneDTO => ({
  id: z.id,
  name: z.name,
  regions: z.regions,
  standardRate: z.standardRate,
  expressRate: z.expressRate,
  freeOverAmount: z.freeOverAmount,
  codFee: z.codFee,
  codEnabled: z.codEnabled,
  estimatedDays: z.estimatedDays,
  position: z.position,
  isActive: z.isActive,
});

export async function listZones(): Promise<ShippingZoneDTO[]> {
  const zones = await prisma.shippingZone.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return zones.map(toZoneDTO);
}

/** A city may belong to only one active zone, otherwise which rate applies is ambiguous. */
async function assertRegionsFree(regions: string[] | undefined, exceptId?: string) {
  if (!regions?.length) return;
  const clash = await prisma.shippingZone.findFirst({
    where: {
      isActive: true,
      regions: { hasSome: regions },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  if (clash) {
    const shared = regions.filter((r) => clash.regions.includes(r));
    invalid(
      "regions",
      `${shared.map((r) => (r === "*" ? "Everywhere else (*)" : r)).join(", ")} already belong${shared.length === 1 ? "s" : ""} to ${clash.name}`,
    );
  }
}

export async function createZone(input: CreateShippingZoneInput) {
  if (input.isActive) await assertRegionsFree(input.regions);
  return toZoneDTO(await prisma.shippingZone.create({ data: input }));
}

export async function updateZone(id: string, input: UpdateShippingZoneInput) {
  const current = await prisma.shippingZone.findUnique({ where: { id } });
  if (!current) throw AppError.notFound("Shipping zone");
  if (input.isActive ?? current.isActive) {
    await assertRegionsFree(input.regions ?? current.regions, id);
  }
  return toZoneDTO(await prisma.shippingZone.update({ where: { id }, data: input }));
}

export async function deleteZone(id: string) {
  const { count } = await prisma.shippingZone.deleteMany({ where: { id } });
  if (count === 0) throw AppError.notFound("Shipping zone");
}
