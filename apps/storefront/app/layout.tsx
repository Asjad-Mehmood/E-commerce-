import type { HomeContentDTO } from "@hoodie/types";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar, Header } from "@/components/layout/header";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/lib/config";
import { getDataSafe } from "@/lib/server-api";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name}: Streetwear Hoodies in Pakistan`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#111111" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const home = await getDataSafe<HomeContentDTO | null>("/cms/home", null, { revalidate: 300 });

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#main"
            className="focus:bg-ink sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:px-3 focus:py-2 focus:text-white"
          >
            Skip to content
          </a>
          <AnnouncementBar text={home?.announcement ?? null} />
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <CartDrawer />
        </Providers>
        {/* Cookie-free page-view analytics and Core Web Vitals (only active on Vercel). */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
