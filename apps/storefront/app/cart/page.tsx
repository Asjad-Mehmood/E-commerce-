import type { Metadata } from "next";
import { CartPageContent } from "@/components/cart/cart-page";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default function CartPage() {
  return <CartPageContent />;
}
