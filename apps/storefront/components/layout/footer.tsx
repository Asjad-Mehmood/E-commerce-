import { Container, Logo } from "@hoodie/ui";
import Link from "next/link";
import { footerNav, siteConfig } from "@/lib/config";
import { NewsletterForm } from "../home/newsletter-form";

export function Footer() {
  return (
    <footer className="border-line bg-surface mt-24 border-t">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo markClassName="size-7" />
          <p className="text-muted mt-3 max-w-sm text-sm">{siteConfig.description}</p>
          <div className="mt-6 max-w-sm">
            <p className="text-sm font-semibold">Get new drops first</p>
            <NewsletterForm />
          </div>
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
          <p>Cash on Delivery nationwide</p>
        </Container>
      </div>
    </footer>
  );
}
