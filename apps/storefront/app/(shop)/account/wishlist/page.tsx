import type { Metadata } from "next";
import { Wishlist } from "@/components/account/wishlist";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return <Wishlist />;
}
