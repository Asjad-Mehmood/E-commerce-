import type { Metadata } from "next";
import { EditProduct } from "@/admin/components/products/product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditProduct id={(await params).id} />;
}
