import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { adminConfig } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Hoodie Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Phase 1 replaces this with the signed-in admin's role from GET /auth/me.
  const role = "SUPER_ADMIN" as const;

  return (
    <html lang="en">
      <body className="bg-surface flex min-h-dvh">
        <Sidebar role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-line bg-canvas flex h-16 items-center justify-between border-b px-6">
            <span className="text-muted text-sm">Signed in as Super Admin</span>
            <a
              href={adminConfig.storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium hover:underline"
            >
              View store ↗
            </a>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
