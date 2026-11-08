import type { Metadata } from "next";
import { ReturnDetail } from "@/admin/components/returns/returns";

export const metadata: Metadata = { title: "Return" };

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  return <ReturnDetail id={(await params).id} />;
}
