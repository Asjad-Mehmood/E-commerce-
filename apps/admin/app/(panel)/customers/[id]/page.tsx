import type { Metadata } from "next";
import { CustomerDetail } from "@/components/customers/customers";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  return <CustomerDetail id={(await params).id} />;
}
