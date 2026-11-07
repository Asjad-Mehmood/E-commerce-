import type { Prisma } from "@prisma/client";

/**
 * Atomic stock operations. Each is a single conditional UPDATE, so concurrent
 * checkouts can never oversell: if two shoppers race for the last unit, one
 * statement matches and the other matches zero rows.
 *
 *   available = stock - reserved
 */
type Tx = Prisma.TransactionClient;

/** Hold units for an unpaid card order. Returns false if not enough is available. */
export async function reserve(tx: Tx, variantId: string, qty: number): Promise<boolean> {
  const n = await tx.$executeRaw`
    UPDATE "ProductVariant" SET reserved = reserved + ${qty}, "updatedAt" = now()
    WHERE id = ${variantId} AND "isActive" = true AND stock - reserved >= ${qty}`;
  return n === 1;
}

/** Sell units straight from available stock (Cash on Delivery). */
export async function sell(tx: Tx, variantId: string, qty: number): Promise<boolean> {
  const n = await tx.$executeRaw`
    UPDATE "ProductVariant" SET stock = stock - ${qty}, "updatedAt" = now()
    WHERE id = ${variantId} AND "isActive" = true AND stock - reserved >= ${qty}`;
  return n === 1;
}

/** Turn a reservation into a sale once the card payment succeeds. */
export async function sellReserved(tx: Tx, variantId: string, qty: number): Promise<boolean> {
  const n = await tx.$executeRaw`
    UPDATE "ProductVariant" SET stock = stock - ${qty}, reserved = reserved - ${qty}, "updatedAt" = now()
    WHERE id = ${variantId} AND reserved >= ${qty} AND stock >= ${qty}`;
  return n === 1;
}

/** Give back a reservation (unpaid order cancelled or expired). */
export async function release(tx: Tx, variantId: string, qty: number): Promise<void> {
  await tx.$executeRaw`
    UPDATE "ProductVariant" SET reserved = GREATEST(reserved - ${qty}, 0), "updatedAt" = now()
    WHERE id = ${variantId}`;
}

/** Put sold units back on the shelf (a confirmed order was cancelled). */
export async function restock(tx: Tx, variantId: string, qty: number): Promise<void> {
  await tx.$executeRaw`
    UPDATE "ProductVariant" SET stock = stock + ${qty}, "updatedAt" = now() WHERE id = ${variantId}`;
}
