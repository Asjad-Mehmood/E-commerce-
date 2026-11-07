"use client";

import type { CartDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { cn } from "@hoodie/ui";
import Link from "next/link";
import { CouponForm } from "./coupon-form";

/** Subtotal, discount and the checkout button. */
export function CartSummary({ cart, showCoupon = false }: { cart: CartDTO; showCoupon?: boolean }) {
  const blocked = cart.warnings.length > 0;
  const discount = cart.coupon?.isValid ? cart.coupon.discount : 0;

  return (
    <div className="space-y-3">
      {showCoupon && <CouponForm coupon={cart.coupon} />}
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd data-testid="cart-subtotal" className="tabular-nums">
            {formatMoney(cart.subtotal)}
          </dd>
        </div>
        {discount > 0 && (
          <div className="text-success flex justify-between">
            <dt>Discount ({cart.coupon!.code})</dt>
            <dd className="tabular-nums">−{formatMoney(discount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd data-testid="cart-total" className="tabular-nums">
            {formatMoney(cart.total)}
          </dd>
        </div>
      </dl>
      <p className="text-muted text-xs">Delivery is calculated at checkout.</p>
      <Link
        href="/checkout"
        aria-disabled={blocked}
        onClick={(e) => blocked && e.preventDefault()}
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-lg text-base font-medium text-white",
          blocked ? "bg-muted pointer-events-none" : "bg-ink hover:bg-ink/85",
        )}
      >
        {blocked ? "Fix the items above to continue" : "Checkout"}
      </Link>
    </div>
  );
}
