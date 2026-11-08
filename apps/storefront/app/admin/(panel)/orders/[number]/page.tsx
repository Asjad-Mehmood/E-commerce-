import type { Metadata } from "next";
import { OrderDetail } from "@/admin/components/orders/order-detail";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${decodeURIComponent((await params).number)}` };
}

export default async function OrderPage({ params }: Props) {
  return <OrderDetail number={decodeURIComponent((await params).number)} />;
}
