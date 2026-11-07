import type { ReactNode } from "react";
import { ShopChrome } from "@/components/layout/shop-chrome";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return <ShopChrome>{children}</ShopChrome>;
}
