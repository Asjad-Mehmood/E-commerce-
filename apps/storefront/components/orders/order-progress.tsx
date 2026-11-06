import type { OrderEventDTO, OrderStatus } from "@hoodie/types";
import { ORDER_STATUS_LABEL } from "@hoodie/types";
import { cn } from "@hoodie/ui";

const STEPS: { label: string; reached: OrderStatus[] }[] = [
  { label: "Confirmed", reached: ["CONFIRMED", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
  { label: "Being prepared", reached: ["PROCESSING", "SHIPPED", "DELIVERED"] },
  { label: "Shipped", reached: ["SHIPPED", "DELIVERED"] },
  { label: "Delivered", reached: ["DELIVERED"] },
];

/** Four-step progress bar for normal orders. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED" || status === "PENDING_PAYMENT") return null;
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
      {STEPS.map((step) => {
        const done = step.reached.includes(status);
        return (
          <li
            key={step.label}
            aria-current={
              done && STEPS.filter((s) => s.reached.includes(status)).at(-1) === step
                ? "step"
                : undefined
            }
          >
            <div className={cn("h-1.5 rounded-full", done ? "bg-ink" : "bg-line")} />
            <p className={cn("mt-2 text-xs sm:text-sm", done ? "font-medium" : "text-muted")}>
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderTimeline({ events }: { events: OrderEventDTO[] }) {
  return (
    <ol className="border-line space-y-4 border-l pl-5">
      {[...events].reverse().map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span
            className={cn(
              "absolute -left-[25px] top-1.5 size-2.5 rounded-full",
              i === 0 ? "bg-ink" : "bg-line",
            )}
          />
          <p className="text-sm font-medium">{ORDER_STATUS_LABEL[e.status]}</p>
          {e.note && <p className="text-muted text-sm">{e.note}</p>}
          <time dateTime={e.at} className="text-muted text-xs">
            {new Date(e.at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </li>
      ))}
    </ol>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === "CANCELLED" || status === "REFUNDED"
      ? "bg-danger/10 text-danger"
      : status === "PENDING_PAYMENT"
        ? "bg-warning/20 text-ink"
        : status === "DELIVERED"
          ? "bg-success/10 text-success"
          : "bg-surface text-ink";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
