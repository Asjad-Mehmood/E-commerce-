import {
  DEFAULT_CURRENCY,
  ErrorCode,
  type AppliedCouponDTO,
  type CartDTO,
  type CartItemDTO,
} from "@hoodie/types";
import { MAX_QTY_PER_ITEM } from "@hoodie/validation";
import type { Prisma } from "@prisma/client";
import { randomToken } from "../../lib/crypto";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { available, effectivePrice, stockStatus } from "../catalog/catalog.mapper";
import { checkCoupon, couponDiscount } from "../checkout/pricing";

/** Who owns the cart: a signed-in user, or a guest identified by the cart cookie. */
export interface CartOwner {
  userId?: string;
  guestToken?: string;
}

export const cartInclude = {
  coupon: true,
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              basePrice: true,
              compareAtPrice: true,
              images: {
                select: { url: true, alt: true, color: true },
                orderBy: { position: "asc" },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

const EMPTY_CART: CartDTO = {
  id: null,
  items: [],
  itemCount: 0,
  subtotal: 0,
  coupon: null,
  total: 0,
  currency: DEFAULT_CURRENCY,
  warnings: [],
};

export function findCart(owner: CartOwner) {
  if (owner.userId)
    return prisma.cart.findUnique({ where: { userId: owner.userId }, include: cartInclude });
  if (owner.guestToken)
    return prisma.cart.findUnique({ where: { token: owner.guestToken }, include: cartInclude });
  return Promise.resolve(null);
}

/** Most of a variant a customer may hold in their cart right now. */
const maxQuantity = (v: { stock: number; reserved: number }) =>
  Math.min(available(v), MAX_QTY_PER_ITEM);

/** The applied coupon with its discount on `subtotal`, or why it no longer applies. */
export function describeCoupon(
  coupon: CartWithItems["coupon"],
  subtotal: number,
  usesByCustomer = 0,
): AppliedCouponDTO | null {
  if (!coupon) return null;
  const check = checkCoupon(coupon, { subtotal, usesByCustomer });
  return {
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    discount: check.ok ? couponDiscount(coupon, subtotal) : 0,
    isValid: check.ok,
    message: check.ok ? null : check.reason,
  };
}

/** Orders that used this coupon for a customer (cancelled orders do not count). */
export async function couponUsesBy(
  couponId: string,
  customer: { userId?: string; email?: string },
) {
  if (!customer.userId && !customer.email) return 0;
  return prisma.order.count({
    where: {
      couponId,
      status: { not: "CANCELLED" },
      OR: [
        ...(customer.userId ? [{ userId: customer.userId }] : []),
        ...(customer.email ? [{ email: customer.email }] : []),
      ],
    },
  });
}

export function toCartDTO(cart: CartWithItems | null, usesByCustomer = 0): CartDTO {
  if (!cart) return EMPTY_CART;

  const warnings: string[] = [];
  const items = cart.items.map((item): CartItemDTO => {
    const { variant } = item;
    const { product } = variant;
    const isAvailable = variant.isActive && product.status === "ACTIVE";
    const max = isAvailable ? maxQuantity(variant) : 0;
    const label = `${product.title} (${variant.size}, ${variant.color})`;
    const unitPrice = effectivePrice(variant, product.basePrice);

    if (!isAvailable) warnings.push(`${label} is no longer available`);
    else if (max === 0) warnings.push(`${label} is sold out`);
    else if (item.quantity > max) warnings.push(`Only ${max} left of ${label}`);

    const image =
      product.images.find((i) => i.color === variant.color) ?? product.images[0] ?? null;

    return {
      id: item.id,
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      image,
      size: variant.size,
      color: variant.color,
      sku: variant.sku,
      unitPrice,
      compareAtPrice: product.compareAtPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      maxQuantity: max,
      stockStatus: isAvailable ? stockStatus(variant) : "out_of_stock",
      isAvailable,
    };
  });

  const subtotal = items.filter((i) => i.isAvailable).reduce((n, i) => n + i.lineTotal, 0);
  const coupon = describeCoupon(cart.coupon, subtotal, usesByCustomer);
  return {
    id: cart.id,
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    coupon,
    total: subtotal - (coupon?.isValid ? coupon.discount : 0),
    currency: DEFAULT_CURRENCY,
    warnings,
  };
}

export async function getCart(owner: CartOwner): Promise<CartDTO> {
  const cart = await findCart(owner);
  const uses =
    cart?.coupon && owner.userId ? await couponUsesBy(cart.coupon.id, { userId: owner.userId }) : 0;
  return toCartDTO(cart, uses);
}

/** Applies a coupon code to the cart (replacing any previous one). */
export async function applyCoupon(owner: CartOwner, code: string): Promise<CartDTO> {
  const cart = await findCart(owner);
  if (!cart || cart.items.length === 0)
    throw AppError.badRequest("Add something to your cart first");
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon)
    throw new AppError(ErrorCode.VALIDATION_ERROR, "This code is not valid", {
      fieldErrors: { code: ["This code is not valid"] },
    });

  const subtotal = toCartDTO(cart).subtotal;
  const uses = owner.userId ? await couponUsesBy(coupon.id, { userId: owner.userId }) : 0;
  const check = checkCoupon(coupon, { subtotal, usesByCustomer: uses });
  if (!check.ok)
    throw new AppError(ErrorCode.VALIDATION_ERROR, check.reason, {
      fieldErrors: { code: [check.reason] },
    });

  await prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });
  return getCart(owner);
}

export async function removeCoupon(owner: CartOwner): Promise<CartDTO> {
  const cart = await findCart(owner);
  if (cart) await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
  return getCart(owner);
}

async function getSellableVariant(variantId: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { status: true, title: true } } },
  });
  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
    throw AppError.notFound("Product");
  }
  return variant;
}

function assertQuantity(variant: { stock: number; reserved: number }, quantity: number) {
  const max = maxQuantity(variant);
  if (quantity > max) {
    throw new AppError(
      ErrorCode.OUT_OF_STOCK,
      max === 0 ? "This item is sold out" : `Only ${max} available`,
      { available: max },
    );
  }
}

/**
 * Adds a variant (or increases its quantity). Returns the cart and, for a new
 * guest cart, the token the caller must store in the cart cookie.
 */
export async function addItem(
  owner: CartOwner,
  variantId: string,
  quantity: number,
): Promise<{ cart: CartDTO; newGuestToken?: string }> {
  const variant = await getSellableVariant(variantId);

  let cart = await findCart(owner);
  let newGuestToken: string | undefined;
  if (!cart) {
    if (owner.userId) {
      cart = await prisma.cart.create({ data: { userId: owner.userId }, include: cartInclude });
    } else {
      newGuestToken = randomToken();
      cart = await prisma.cart.create({ data: { token: newGuestToken }, include: cartInclude });
    }
  }

  const existing = cart.items.find((i) => i.variantId === variantId);
  assertQuantity(variant, (existing?.quantity ?? 0) + quantity);

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity },
    update: { quantity: { increment: quantity } },
  });
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

  return {
    cart: await getCart(owner.userId ? owner : { guestToken: cart.token ?? undefined }),
    newGuestToken,
  };
}

async function findOwnItem(owner: CartOwner, itemId: string) {
  const cart = await findCart(owner);
  const item = cart?.items.find((i) => i.id === itemId);
  if (!item) throw AppError.notFound("Cart item");
  return item;
}

export async function updateItem(
  owner: CartOwner,
  itemId: string,
  quantity: number,
): Promise<CartDTO> {
  const item = await findOwnItem(owner, itemId);
  // Lowering the quantity is always allowed, even if stock has dropped since.
  if (quantity > item.quantity) assertQuantity(item.variant, quantity);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return getCart(owner);
}

export async function removeItem(owner: CartOwner, itemId: string): Promise<CartDTO> {
  const item = await findOwnItem(owner, itemId);
  await prisma.cartItem.delete({ where: { id: item.id } });
  return getCart(owner);
}

export async function clearCart(owner: CartOwner): Promise<CartDTO> {
  const cart = await findCart(owner);
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(owner);
}

/**
 * Moves a guest cart into the user's cart after sign-in. Quantities of the same
 * variant are added together, capped at what can currently be bought.
 */
export async function mergeGuestCart(guestToken: string, userId: string): Promise<void> {
  const guest = await prisma.cart.findUnique({
    where: { token: guestToken },
    include: {
      items: { include: { variant: { include: { product: { select: { status: true } } } } } },
    },
  });
  if (!guest) return;

  await prisma.$transaction(async (tx) => {
    const userCart = await tx.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { items: true },
    });

    for (const item of guest.items) {
      const { variant } = item;
      if (!variant.isActive || variant.product.status !== "ACTIVE") continue;
      const current = userCart.items.find((i) => i.variantId === variant.id)?.quantity ?? 0;
      const quantity = Math.min(current + item.quantity, maxQuantity(variant));
      if (quantity <= 0) continue;

      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: variant.id } },
        create: { cartId: userCart.id, variantId: variant.id, quantity },
        update: { quantity },
      });
    }

    if (guest.couponId && !userCart.couponId) {
      await tx.cart.update({ where: { id: userCart.id }, data: { couponId: guest.couponId } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
