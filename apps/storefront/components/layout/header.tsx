import type { CategoryDTO, CollectionDTO } from "@hoodie/types";
import { Container } from "@hoodie/ui";
import Link from "next/link";
import { siteConfig } from "@/lib/config";
import { getDataSafe } from "@/lib/server-api";
import { HeaderActions } from "./header-actions";
import { MegaMenu } from "./mega-menu";
import { MobileNav, MobileNavButton } from "./mobile-nav";

export interface NavData {
  categories: CategoryDTO[];
  collections: CollectionDTO[];
}

export async function Header() {
  const [categories, collections] = await Promise.all([
    getDataSafe<CategoryDTO[]>("/categories", [], { revalidate: 300 }),
    getDataSafe<CollectionDTO[]>("/collections", [], { revalidate: 300 }),
  ]);
  const nav: NavData = { categories, collections };

  return (
    <header className="border-line bg-canvas/95 sticky top-0 z-40 border-b backdrop-blur">
      <Container className="flex h-16 items-center gap-4">
        <MobileNavButton />
        <Link href="/" className="text-lg font-black uppercase tracking-tight">
          {siteConfig.name}
        </Link>

        <nav aria-label="Main" className="ml-8 hidden items-center gap-1 lg:flex">
          <MegaMenu {...nav} />
          <Link
            href="/collections/new-arrivals"
            className="hover:bg-surface rounded-lg px-3 py-2 text-sm font-medium"
          >
            New arrivals
          </Link>
          <Link
            href="/collections/best-sellers"
            className="hover:bg-surface rounded-lg px-3 py-2 text-sm font-medium"
          >
            Best sellers
          </Link>
          <Link
            href="/size-guide"
            className="hover:bg-surface rounded-lg px-3 py-2 text-sm font-medium"
          >
            Size guide
          </Link>
        </nav>

        <HeaderActions />
      </Container>
      <MobileNav {...nav} />
    </header>
  );
}

export function AnnouncementBar({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="bg-ink px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      {text}
    </div>
  );
}
