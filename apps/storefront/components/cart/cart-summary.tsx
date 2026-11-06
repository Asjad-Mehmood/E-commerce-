"use client";

import type { CartDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { Button } from "@hoodie/ui";

/** Subtotal and the checkout button (checkout is built in the next phase). */
export function CartSummary({ cart }: { cart: CartDTO }) {
  const blocked = cart.warnings.length > 0;
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-base font-semibold">
        <span>Subtotal</span>
        <span data-testid="cart-subtotal" className="tabular-nums">
          {formatMoney(cart.subtotal)}
        </span>
      </div>
      <p className="text-muted text-xs">Shipping and discounts are calculated at checkout.</p>
      <Button size="lg" className="w-full" disabled title="Checkout is coming soon">
        {blocked ? "Fix the items above to continue" : "Checkout (coming soon)"}
      </Button>
    </div>
  );
}
