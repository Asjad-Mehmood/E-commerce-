import { Container } from "@hoodie/ui";
import Link from "next/link";
import { mainNav, siteConfig } from "@/lib/config";
import { BagIcon, HeartIcon, SearchIcon, UserIcon } from "./icons";

export function AnnouncementBar() {
  return (
    <div className="bg-ink px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      Free delivery on orders over Rs 5,000 · Cash on Delivery available nationwide
    </div>
  );
}

export function Header() {
  return (
    <header className="border-line bg-canvas/95 sticky top-0 z-40 border-b backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="text-lg font-black uppercase tracking-tight">
          {siteConfig.name}
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted hover:text-ink text-sm font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link href="/search" aria-label="Search" className="hover:bg-surface rounded-lg p-2">
            <SearchIcon />
          </Link>
          <Link
            href="/account/wishlist"
            aria-label="Wishlist"
            className="hover:bg-surface hidden rounded-lg p-2 sm:block"
          >
            <HeartIcon />
          </Link>
          <Link href="/account" aria-label="Account" className="hover:bg-surface rounded-lg p-2">
            <UserIcon />
          </Link>
          <Link
            href="/cart"
            aria-label="Cart, 0 items"
            className="hover:bg-surface relative rounded-lg p-2"
          >
            <BagIcon />
            <span className="bg-brand-600 absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full text-[10px] font-bold text-white">
              0
            </span>
          </Link>
        </div>
      </Container>
    </header>
  );
}
