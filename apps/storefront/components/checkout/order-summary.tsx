"use client";

import type { CartDTO, QuoteDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { Skeleton } from "@hoodie/ui";
import Image from "next/image";
import { CouponForm } from "../cart/coupon-form";

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div
      className={tone === "success" ? "text-success flex justify-between" : "flex justify-between"}
    >
      <dt className={tone ? undefined : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function OrderSummary({
  cart,
  quote,
  loading,
  onCouponChange,
}: {
  cart: CartDTO;
  quote: QuoteDTO | undefined;
  loading: boolean;
  onCouponChange: () => void;
}) {
  return (
    <div className="space-y-5">
      <ul className="space-y-4">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <div className="bg-surface relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg">
              {item.image && (
                <Image src={item.image.url} alt="" fill sizes="56px" className="object-cover" />
              )}
              <span className="bg-ink absolute -right-0 -top-0 grid min-w-5 place-items-center rounded-bl-lg px-1 text-[11px] font-bold text-white">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{item.title}</p>
              <p className="text-muted text-xs">
                {item.color} · {item.size}
              </p>
            </div>
            <p className="text-sm tabular-nums">{formatMoney(item.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <CouponForm coupon={cart.coupon} onChange={onCouponChange} />

      {!quote ? (
        <Skeleton className="h-28" />
      ) : (
        <dl
          className={loading ? "space-y-1.5 text-sm opacity-60" : "space-y-1.5 text-sm"}
          aria-busy={loading}
        >
          <Row label="Subtotal" value={formatMoney(quote.subtotal)} />
          {quote.discount > 0 && (
            <Row
              label={`Discount (${quote.coupon?.code})`}
              value={`−${formatMoney(quote.discount)}`}
              tone="success"
            />
          )}
          <Row
            label="Delivery"
            value={quote.shipping === 0 ? "Free" : formatMoney(quote.shipping)}
          />
          {quote.codFee > 0 && (
            <Row label="Cash on Delivery fee" value={formatMoney(quote.codFee)} />
          )}
          {quote.tax > 0 && <Row label="Tax" value={formatMoney(quote.tax)} />}
          <div className="border-line flex justify-between border-t pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd data-testid="checkout-total" className="tabular-nums">
              {formatMoney(quote.total)}
            </dd>
          </div>
          {quote.amountToFreeShipping != null && quote.amountToFreeShipping > 0 && (
            <p className="text-muted pt-1 text-xs">
              Add {formatMoney(quote.amountToFreeShipping)} more for free standard delivery.
            </p>
          )}
        </dl>
      )}
    </div>
  );
}
