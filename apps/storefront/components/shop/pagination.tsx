import { cn } from "@hoodie/ui";
import Link from "next/link";
import type { SearchParams } from "@/lib/listing";

function href(pathname: string, sp: SearchParams, page: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") p.set(k, v);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Page links: first, last, and two either side of the current page. */
export function Pagination({
  page,
  totalPages,
  pathname,
  searchParams,
}: {
  page: number;
  totalPages: number;
  pathname: string;
  searchParams: SearchParams;
}) {
  if (totalPages <= 1) return null;
  const pages = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, totalPages])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const item = "grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-medium";
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link
          href={href(pathname, searchParams, page - 1)}
          className={cn(item, "hover:bg-surface")}
          rel="prev"
        >
          ← Prev
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - pages[i - 1]! > 1 && <span className="text-muted px-1">…</span>}
          <Link
            href={href(pathname, searchParams, p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-ink text-white" : "hover:bg-surface")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages && (
        <Link
          href={href(pathname, searchParams, page + 1)}
          className={cn(item, "hover:bg-surface")}
          rel="next"
        >
          Next →
        </Link>
      )}
    </nav>
  );
}
