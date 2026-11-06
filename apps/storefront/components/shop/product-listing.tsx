import type { FiltersDTO, ProductCardDTO } from "@hoodie/types";
import { Container } from "@hoodie/ui";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { countActiveFilters, parseFilters, toApiQuery, type SearchParams } from "@/lib/listing";
import { getData, getList } from "@/lib/server-api";
import { ProductGrid } from "../product/product-card";
import { FilterPanel, MobileFilters } from "./filter-panel";
import { ListingNavProvider, ResultsArea } from "./listing-nav";
import { Pagination } from "./pagination";
import { ActiveFilters, SortSelect } from "./toolbar";

export interface ListingProps {
  title: string;
  description?: string | null;
  pathname: string;
  searchParams: SearchParams;
  scope?: { category?: string; collection?: string };
  breadcrumbs?: ReactNode;
  /** Shown above the grid, e.g. the search box. */
  header?: ReactNode;
}

/** Shared listing page for shop, category, collection and search. */
export async function ProductListing({
  title,
  description,
  pathname,
  searchParams,
  scope = {},
  breadcrumbs,
  header,
}: ListingProps) {
  const filters = parseFilters(searchParams);
  const scopeQuery = new URLSearchParams(scope as Record<string, string>).toString();

  const [products, options] = await Promise.all([
    getList<ProductCardDTO>(`/products?${toApiQuery(filters, scope)}`),
    getData<FiltersDTO>(`/filters?${scopeQuery}`, { revalidate: 300 }),
  ]);
  const filterOptions = options ?? { sizes: [], colors: [], fits: [], price: { min: 0, max: 0 } };
  const { total, totalPages } = products.meta;
  const activeCount = countActiveFilters(filters);

  return (
    <Suspense>
      <ListingNavProvider>
        <Container className="py-8 sm:py-12">
          {breadcrumbs}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            {description && <p className="text-muted mt-2 max-w-2xl">{description}</p>}
          </div>
          {header}

          <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
            <aside aria-label="Filters" className="hidden lg:block">
              <FilterPanel filters={filterOptions} />
            </aside>

            <div>
              <div className="mb-6 flex items-center justify-between gap-3">
                <p className="text-muted text-sm" aria-live="polite">
                  {total} {total === 1 ? "product" : "products"}
                </p>
                <div className="flex items-center gap-2">
                  <MobileFilters
                    filters={filterOptions}
                    activeCount={activeCount}
                    resultCount={total}
                  />
                  <SortSelect value={filters.sort} />
                </div>
              </div>
              <div className="mb-6">
                <ActiveFilters />
              </div>

              <ResultsArea>
                {products.data.length > 0 ? (
                  <ProductGrid products={products.data} priorityCount={4} />
                ) : (
                  <div className="bg-surface rounded-2xl px-6 py-20 text-center">
                    <p className="text-lg font-semibold">No hoodies match these filters</p>
                    <p className="text-muted mt-2 text-sm">Try removing a filter or two.</p>
                    <Link
                      href={pathname}
                      className="bg-ink mt-6 inline-flex h-10 items-center rounded-lg px-5 text-sm font-semibold text-white"
                    >
                      Clear filters
                    </Link>
                  </div>
                )}
                <Pagination
                  page={filters.page}
                  totalPages={totalPages}
                  pathname={pathname}
                  searchParams={searchParams}
                />
              </ResultsArea>
            </div>
          </div>
        </Container>
      </ListingNavProvider>
    </Suspense>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
