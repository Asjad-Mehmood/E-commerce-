import { formatMoney } from "@hoodie/types";
import { cn } from "@hoodie/ui";

export function Price({
  price,
  compareAtPrice,
  from,
  className,
}: {
  price: number;
  compareAtPrice?: number | null;
  /** Show "From" when variants have different prices. */
  from?: boolean;
  className?: string;
}) {
  const onSale = compareAtPrice != null && compareAtPrice > price;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-semibold", onSale && "text-danger")}>
        {from && <span className="text-muted font-normal">From </span>}
        {formatMoney(price)}
      </span>
      {onSale && (
        <s className="text-muted text-sm" aria-label={`was ${formatMoney(compareAtPrice)}`}>
          {formatMoney(compareAtPrice)}
        </s>
      )}
    </p>
  );
}
