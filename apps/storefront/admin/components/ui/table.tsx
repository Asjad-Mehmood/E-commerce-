"use client";

import type { PaginationMeta } from "@hoodie/types";
import { Button, cn, Skeleton } from "@hoodie/ui";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** Scrollable table wrapper: wide tables scroll inside the card on small screens. */
export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="border-line bg-canvas rounded-(--radius-card) overflow-x-auto border">
      <table className={cn("w-full min-w-max text-left text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "bg-surface text-muted border-line border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-line border-b px-4 py-3 align-middle", className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-surface/60 last:[&>td]:border-b-0", className)} {...props} />;
}

/** Placeholder rows while a table loads. */
export function LoadingRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <Td key={c}>
              <Skeleton className="h-4 w-full max-w-40" />
            </Td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A single full-width row for "nothing here" / errors. */
export function TableMessage({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="text-muted px-4 py-12 text-center text-sm">
        {children}
      </td>
    </tr>
  );
}

export function Pagination({
  meta,
  onPage,
  label = "results",
}: {
  meta: PaginationMeta | undefined;
  onPage: (page: number) => void;
  label?: string;
}) {
  if (!meta) return null;
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav
      aria-label="Pagination"
      className="text-muted flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p>
        {meta.total === 0
          ? `No ${label}`
          : `${from.toLocaleString()}–${to.toLocaleString()} of ${meta.total.toLocaleString()} ${label}`}
      </p>
      {meta.totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => onPage(meta.page - 1)}
          >
            Previous
          </Button>
          <span className="tabular-nums">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPage(meta.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </nav>
  );
}
