import type { HomeContentDTO } from "@hoodie/types";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar, Header } from "@/components/layout/header";
import { Providers } from "@/components/providers";
import { getDataSafe } from "@/lib/server-api";

/** The shop's header, footer and cart around a page. */
export async function ShopChrome({ children }: { children: ReactNode }) {
  const home = await getDataSafe<HomeContentDTO | null>("/cms/home", null, { revalidate: 300 });
  return (
    <div className="flex min-h-dvh flex-col">
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
    </div>
  );
}
