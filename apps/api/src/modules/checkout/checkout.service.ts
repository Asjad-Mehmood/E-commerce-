import {
  DEFAULT_CURRENCY,
  ErrorCode,
  type CheckoutResultDTO,
  type PaymentOptionDTO,
  type QuoteDTO,
  type ShippingMethodId,
} from "@hoodie/types";
import type { CheckoutInput, QuoteInput } from "@hoodie/validation";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { getSettings } from "../../lib/settings";
import { AppError } from "../../utils/app-error";
import {
  couponUsesBy,
  describeCoupon,
  findCart,
  toCartDTO,
  type CartOwner,
  type CartWithItems,
} from "../cart/cart.service";
import { addSold, cancelOrder, clearOrderedFromCart } from "../orders/lifecycle";
import { orderAccessToken } from "../orders/order-access";
import { confirmationEmail } from "../orders/order.emails";
import { orderInclude } from "../orders/order.mapper";
import * as stock from "../orders/stock";
import { getPaymentProvider } from "../payments";
import {
  amountToFreeShipping,
  computeTotals,
  pickZone,
  shippingOptions,
  type Totals,
} from "./pricing";

const STORE_DEFAULTS = {
  "tax.rate": 0,
  "tax.inclusive": true,
  "payments.cod.enabled": true,
  "payments.card.enabled": false,
  "orders.numberPrefix": "US-",
};

interface Customer {
  userId?: string;
  email?: string;
}

interface Priced {
  quote: QuoteDTO;
  totals: Totals;
  zoneName: string;
}

/** Prices the cart for a destination, delivery method and payment method. */
async function price(cart: CartWithItems, input: QuoteInput, customer: Customer): Promise<Priced> {
  const [zones, settings] = await Promise.all([
    prisma.shippingZone.findMany(),
    getSettings(STORE_DEFAULTS),
  ]);
  const zone = pickZone(zones, input.city);
  if (!zone)
    throw new AppError(
      ErrorCode.SERVICE_UNAVAILABLE,
      "We don't deliver to this location yet",
      undefined,
      400,
    );

  const uses = cart.coupon ? await couponUsesBy(cart.coupon.id, customer) : 0;
  const cartDto = toCartDTO(cart, uses);
  const coupon = describeCoupon(cart.coupon, cartDto.subtotal, uses);
  const discount = coupon?.isValid ? coupon.discount : 0;
  const freeShippingCoupon = !!coupon?.isValid && coupon.type === "FREE_SHIPPING";

  const options = shippingOptions(zone, {
    discountedSubtotal: cartDto.subtotal - discount,
    freeShippingCoupon,
  });
  const shipping = options.find((o) => o.id === input.shippingMethod) ?? options[0]!;

  const provider = getPaymentProvider();
  const paymentOptions: PaymentOptionDTO[] = [
    {
      method: "STRIPE",
      label: "Credit or debit card",
      fee: 0,
      available: !!provider && settings["payments.card.enabled"] !== false,
      demo: provider?.name === "demo",
    },
    {
      method: "COD",
      label: "Cash on Delivery",
      fee: zone.codFee,
      available: settings["payments.cod.enabled"] !== false && zone.codEnabled,
    },
  ];
  const chosen =
    paymentOptions.find((p) => p.method === input.paymentMethod && p.available) ??
    paymentOptions.find((p) => p.available);

  const totals = computeTotals({
    subtotal: cartDto.subtotal,
    discount,
    shipping: shipping.price,
    codFee: chosen?.method === "COD" ? zone.codFee : 0,
    taxRate: Number(settings["tax.rate"]) || 0,
    taxInclusive: settings["tax.inclusive"] !== false,
  });

  return {
    zoneName: zone.name,
    totals,
    quote: {
      zone: zone.name,
      shippingOptions: options,
      shippingMethod: shipping.id,
      paymentOptions,
      paymentMethod: chosen?.method ?? "COD",
      subtotal: totals.subtotal,
      discount: totals.discount,
      shipping: totals.shipping,
      codFee: totals.codFee,
      tax: totals.tax,
      total: totals.total,
      currency: DEFAULT_CURRENCY,
      coupon,
      amountToFreeShipping: freeShippingCoupon
        ? null
        : amountToFreeShipping(zone, cartDto.subtotal - discount),
    },
  };
}

async function requireCart(owner: CartOwner): Promise<CartWithItems> {
  const cart = await findCart(owner);
  if (!cart || cart.items.length === 0) throw AppError.badRequest("Your cart is empty");
  return cart;
}

export async function quote(
  owner: CartOwner,
  input: QuoteInput,
  customer: Customer,
): Promise<QuoteDTO> {
  return (await price(await requireCart(owner), input, customer)).quote;
}

async function resultFor(orderId: string): Promise<CheckoutResultDTO> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: true },
  });
  const pending = order.paymentMethod === "STRIPE" && order.status === "PENDING_PAYMENT";
  const intent = order.payments.find((p) => p.providerRef);
  const provider = getPaymentProvider();

  return {
    orderNumber: order.orderNumber,
    accessToken: orderAccessToken(order.id),
    status: order.status,
    total: order.grandTotal,
    payment:
      pending && intent && provider
        ? {
            provider: provider.name,
            clientSecret: await provider.getClientSecret(intent.providerRef!),
            publishableKey: provider.publishableKey,
            amount: order.grandTotal,
            currency: order.currency,
          }
        : null,
  };
}

/**
 * Places an order from the current cart.
 *
 * Everything that touches stock happens in one transaction: every line is
 * reserved (card) or sold (Cash on Delivery) with an atomic conditional update,
 * so if any line is short the whole order rolls back and nothing is held.
 */
export async function placeOrder(
  owner: CartOwner,
  input: CheckoutInput,
): Promise<CheckoutResultDTO> {
  // A resubmitted checkout (double click, network retry) returns the same order.
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    const cart = await findCart(owner);
    const sameOwner = owner.userId
      ? existing.userId === owner.userId
      : !!cart && existing.cartId === cart.id;
    if (!sameOwner) throw AppError.conflict("This checkout key was already used");
    return resultFor(existing.id);
  }

  // An unpaid card order started earlier from this cart still holds its stock.
  // Cancel it first, so the shopper is not told their own reservation is "sold out".
  const startCart = await requireCart(owner);
  const abandoned = await prisma.order.findMany({
    where: { cartId: startCart.id, status: "PENDING_PAYMENT" },
    select: { id: true },
  });
  for (const o of abandoned) {
    await cancelOrder(o.id, {
      reason: "Replaced by a new checkout.",
      allowed: ["PENDING_PAYMENT"],
      notify: false,
    }).catch(() => undefined);
  }

  const cart = abandoned.length ? await requireCart(owner) : startCart;
  const customer = { userId: owner.userId, email: input.email };
  const cartDto = toCartDTO(cart);
  if (cartDto.warnings.length) {
    throw new AppError(ErrorCode.CONFLICT, "Some items in your cart need attention", {
      warnings: cartDto.warnings,
    });
  }

  const { quote: q, totals } = await price(
    cart,
    {
      city: input.shippingAddress.city,
      shippingMethod: input.shippingMethod,
      paymentMethod: input.paymentMethod,
    },
    customer,
  );
  if (q.paymentMethod !== input.paymentMethod)
    throw AppError.badRequest("This payment method is not available");
  if (q.shippingMethod !== input.shippingMethod)
    throw AppError.badRequest("This delivery option is not available for your address");
  if (q.coupon && !q.coupon.isValid) {
    throw new AppError(
      ErrorCode.CONFLICT,
      q.coupon.message ?? "Your discount code no longer applies",
      { coupon: q.coupon.message },
    );
  }

  const card = input.paymentMethod === "STRIPE";
  const provider = card ? getPaymentProvider() : null;
  const settings = await getSettings(STORE_DEFAULTS);

  const orderId = await prisma
    .$transaction(async (tx) => {
      for (const item of cart.items) {
        const ok = card
          ? await stock.reserve(tx, item.variantId, item.quantity)
          : await stock.sell(tx, item.variantId, item.quantity);
        if (!ok) {
          throw new AppError(
            ErrorCode.OUT_OF_STOCK,
            `${item.variant.product.title} (${item.variant.size}, ${item.variant.color}) just sold out`,
            {
              variantId: item.variantId,
            },
          );
        }
      }

      if (cart.coupon && q.coupon?.isValid) {
        const n = await tx.$executeRaw`
        UPDATE "Coupon" SET "usedCount" = "usedCount" + 1
        WHERE id = ${cart.coupon.id} AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
        if (n === 0) throw AppError.conflict("This discount code has just reached its usage limit");
      }

      const [{ n }] = await tx.$queryRaw<[{ n: bigint }]>`SELECT nextval('order_number_seq') AS n`;
      const items = cartDto.items.map((i) => ({
        variantId: i.variantId,
        productId: i.productId,
        productTitle: i.title,
        productSlug: i.slug,
        size: i.size,
        color: i.color,
        sku: i.sku,
        imageUrl: i.image?.url ?? null,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      }));

      const order = await tx.order.create({
        data: {
          orderNumber: `${settings["orders.numberPrefix"]}${n}`,
          userId: owner.userId ?? null,
          email: input.email,
          phone: input.phone,
          shippingAddress: input.shippingAddress as Prisma.InputJsonValue,
          status: card ? "PENDING_PAYMENT" : "CONFIRMED",
          paymentMethod: input.paymentMethod,
          currency: DEFAULT_CURRENCY,
          subtotal: totals.subtotal,
          discountTotal: totals.discount,
          shippingTotal: totals.shipping,
          codFee: totals.codFee,
          taxTotal: totals.tax,
          grandTotal: totals.total,
          couponId: q.coupon?.isValid ? cart.coupon!.id : null,
          couponCode: q.coupon?.isValid ? q.coupon.code : null,
          shippingMethod: input.shippingMethod satisfies ShippingMethodId,
          customerNote: input.customerNote,
          reservedUntil: card
            ? new Date(Date.now() + env.PAYMENT_RESERVATION_MINUTES * 60_000)
            : null,
          idempotencyKey: input.idempotencyKey,
          cartId: cart.id,
          items: { create: items },
          payments: {
            create: {
              method: input.paymentMethod,
              amount: totals.total,
              currency: DEFAULT_CURRENCY,
            },
          },
          history: {
            create: {
              status: card ? "PENDING_PAYMENT" : "CONFIRMED",
              note: card
                ? "Order placed, awaiting card payment"
                : "Order placed with Cash on Delivery",
            },
          },
        },
        include: { items: true },
      });

      if (!card) {
        await addSold(tx, order.items, 1);
        await clearOrderedFromCart(tx, order);
      }
      if (input.saveAddress && owner.userId) {
        const hasDefault =
          (await tx.address.count({ where: { userId: owner.userId, isDefault: true } })) > 0;
        await tx.address.create({
          data: { ...input.shippingAddress, userId: owner.userId, isDefault: !hasDefault },
        });
      }
      return order.id;
    })
    .catch(async (err) => {
      // Two identical submissions raced: the other one created the order (and this
      // transaction rolled back, releasing anything it held). Return that order.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await prisma.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (winner) return { duplicateOf: winner.id };
      }
      throw err;
    });
  if (typeof orderId === "object") return resultFor(orderId.duplicateOf);

  if (card) {
    try {
      const intent = await provider!.createIntent({
        amount: totals.total,
        currency: DEFAULT_CURRENCY,
        orderNumber: (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).orderNumber,
        email: input.email,
        idempotencyKey: `order-${orderId}`,
      });
      await prisma.payment.updateMany({ where: { orderId }, data: { providerRef: intent.id } });
    } catch (err) {
      logger.error({ err, orderId }, "Could not start card payment");
      await cancelOrder(orderId, {
        reason: "The card payment could not be started.",
        allowed: ["PENDING_PAYMENT"],
        notify: false,
      });
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        "Card payments are unavailable right now. Please try again or choose Cash on Delivery.",
        undefined,
        502,
      );
    }
  } else {
    void sendMail(
      confirmationEmail(
        await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }),
      ),
    );
  }

  return resultFor(orderId);
}
