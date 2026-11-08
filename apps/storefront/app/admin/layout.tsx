import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/admin/components/providers";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Urban Store Admin" },
  // The shop's share image and description don't belong to admin pages.
  openGraph: null,
  description: null,
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface min-h-dvh">
      <Providers>{children}</Providers>
    </div>
  );
}
