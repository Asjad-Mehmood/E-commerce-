import type { Metadata } from "next";
import { ProductListing } from "@/components/shop/product-listing";
import type { SearchParams } from "@/lib/listing";

export const metadata: Metadata = {
  title: "Shop all hoodies",
  description: "Browse every hoodie: pullovers, zip-ups, oversized and graphic styles.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <ProductListing title="All hoodies" pathname="/shop" searchParams={await searchParams} />;
}
