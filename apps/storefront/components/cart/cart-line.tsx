"use client";

import type { CartItemDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { cn } from "@hoodie/ui";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { useRemoveCartItem, useUpdateCartItem } from "@/hooks/use-cart";
import { TrashIcon } from "../icons";
import { QuantityStepper } from "../product/quantity-stepper";

export function CartLine({ item, compact = false }: { item: CartItemDTO; compact?: boolean }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const busy = update.isPending || remove.isPending;
  const over = item.isAvailable && item.quantity > item.maxQuantity;

  const setQuantity = (quantity: number) =>
    update.mutate({ id: item.id, quantity }, { onError: (e) => toast.error(e.message) });

  return (
    <li data-testid="cart-line" className={cn("flex gap-4 py-4", busy && "opacity-60")}>
      <Link
        href={`/products/${item.slug}`}
        className="bg-surface relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-lg sm:w-24"
      >
        {item.image && (
          <Image
            src={item.image.url}
            alt={item.image.alt ?? item.title}
            fill
            sizes="96px"
            className="object-cover"
          />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${item.slug}`}
              className="line-clamp-2 text-sm font-medium hover:underline"
            >
              {item.title}
            </Link>
            <p className="text-muted mt-0.5 text-xs">
              {item.color} · {item.size}
            </p>
          </div>
          <p className="text-sm font-semibold tabular-nums">{formatMoney(item.lineTotal)}</p>
        </div>

        {!item.isAvailable ? (
          <p className="text-danger mt-1 text-xs">No longer available. Please remove it.</p>
        ) : item.maxQuantity === 0 ? (
          <p className="text-danger mt-1 text-xs">Sold out. Please remove it.</p>
        ) : over ? (
          <p className="text-danger mt-1 text-xs">
            Only {item.maxQuantity} left. Please lower the quantity.
          </p>
        ) : !compact && item.quantity > 1 ? (
          <p className="text-muted mt-1 text-xs">{formatMoney(item.unitPrice)} each</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-2">
          <QuantityStepper
            size="sm"
            value={item.quantity}
            max={Math.max(item.maxQuantity, 1)}
            disabled={busy || !item.isAvailable}
            onChange={setQuantity}
            label={`Quantity of ${item.title}`}
          />
          <button
            type="button"
            onClick={() => remove.mutate(item.id)}
            disabled={busy}
            aria-label={`Remove ${item.title} (${item.color}, ${item.size})`}
            className="text-muted hover:text-danger rounded-lg p-2"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </li>
  );
}
