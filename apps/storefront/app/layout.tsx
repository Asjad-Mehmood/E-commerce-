import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/config";
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

/**
 * One site, two areas: the shop (app/(shop), with its header and footer) and
 * the admin panel (app/admin). The API is served under /api/v1 (pages/api).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Cookie-free page-view analytics and Core Web Vitals (only active on Vercel). */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
