import { cn } from "@hoodie/ui";

const PATH = "M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9L10 1.5z";

/** Five stars filled to `rating` (to the nearest half), with the value for screen readers. */
export function Stars({
  rating,
  size = 16,
  className,
  label = true,
}: {
  rating: number;
  size?: number;
  className?: string;
  label?: boolean;
}) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className={cn("inline-flex items-center", className)}>
      {label && <span className="sr-only">{rating.toFixed(1)} out of 5 stars</span>}
      <span aria-hidden className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
          const star = (cls: string) => (
            <svg width={size} height={size} viewBox="0 0 20 20" className={cls}>
              <path d={PATH} />
            </svg>
          );
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              {star("fill-line")}
              {fill > 0 && (
                <span
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  {star("fill-ink max-w-none")}
                </span>
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}
