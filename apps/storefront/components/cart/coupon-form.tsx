"use client";

import type { AppliedCouponDTO } from "@hoodie/types";
import { formatMoney } from "@hoodie/types";
import { Button, Input } from "@hoodie/ui";
import { useState } from "react";
import { useApplyCoupon, useRemoveCoupon } from "@/hooks/use-cart";
import { ApiError } from "@/lib/api";

/** Discount code entry, or the applied code with a remove button. */
export function CouponForm({
  coupon,
  onChange,
}: {
  coupon: AppliedCouponDTO | null;
  onChange?: () => void;
}) {
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (coupon) {
    return (
      <div className="bg-surface flex items-start justify-between gap-3 rounded-lg p-3 text-sm">
        <div>
          <p className="font-semibold">
            {coupon.code}
            {coupon.isValid && coupon.discount > 0 && (
              <span className="text-success font-normal"> · −{formatMoney(coupon.discount)}</span>
            )}
          </p>
          <p className={coupon.isValid ? "text-muted text-xs" : "text-danger text-xs"}>
            {coupon.isValid ? coupon.description : coupon.message}
          </p>
        </div>
        <button
          type="button"
          className="text-muted hover:text-ink text-xs underline"
          onClick={() => remove.mutate(undefined, { onSuccess: onChange })}
          disabled={remove.isPending}
        >
          Remove
        </button>
      </div>
    );
  }

  const submit = () => {
    if (!code.trim()) return;
    setError(null);
    apply.mutate(code.trim(), {
      onSuccess: () => {
        setCode("");
        onChange?.();
      },
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Could not apply the code"),
    });
  };

  // Not a <form>: this box also appears inside the checkout form, and nested
  // forms are invalid HTML (the inner submit would also submit the checkout).
  return (
    <div className="space-y-1.5">
      <label htmlFor="coupon-code" className="text-sm font-medium">
        Discount code
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="e.g. WELCOME10"
          autoComplete="off"
          invalid={!!error}
          aria-describedby={error ? "coupon-error" : undefined}
        />
        <Button type="button" variant="outline" loading={apply.isPending} onClick={submit}>
          Apply
        </Button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
