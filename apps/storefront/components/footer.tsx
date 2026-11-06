import { Container } from "@hoodie/ui";
import Link from "next/link";
import { footerNav, siteConfig } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-line bg-surface mt-24 border-t">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-black uppercase tracking-tight">{siteConfig.name}</p>
          <p className="text-muted mt-3 max-w-xs text-sm">{siteConfig.description}</p>
        </div>
        {Object.entries(footerNav).map(([heading, links]) => (
          <div key={heading}>
            <p className="text-sm font-semibold">{heading}</p>
            <ul className="mt-3 space-y-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted hover:text-ink text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <div className="border-line border-t">
        <Container className="text-muted flex flex-col gap-2 py-6 text-xs sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p>Cash on Delivery · Visa · Mastercard</p>
        </Container>
      </div>
    </footer>
  );
}
