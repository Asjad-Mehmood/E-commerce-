import { Card, cn } from "@hoodie/ui";
import Link from "@/admin/lib/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  back,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-1">
      {back && (
        <Link href={back.href} className="text-muted hover:text-ink text-sm">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted mt-1 text-sm">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** A titled card section. */
export function Section({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card className={cn("space-y-4", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="text-muted mt-0.5 text-sm">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Card>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-line rounded-(--radius-card) border border-dashed px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="text-muted mx-auto mt-1 max-w-md text-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="border-danger/30 bg-danger/5 text-danger rounded-(--radius-card) border px-4 py-3 text-sm"
    >
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}

/** Label/value pairs, e.g. on detail pages. */
export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
