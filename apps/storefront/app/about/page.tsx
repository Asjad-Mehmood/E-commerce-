import { Container } from "@hoodie/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight">About {siteConfig.name}</h1>
      <div className="mt-8 space-y-4 text-lg leading-relaxed">
        <p>We make one thing, and we make it properly: the hoodie you reach for every day.</p>
        <p className="text-muted">
          Every piece is cut from heavyweight 320–400 GSM cotton fleece, finished with double-lined
          hoods, ribbed cuffs and prints that survive the wash. We design in small batches, so when
          a colour sells out it may not come back.
        </p>
        <p className="text-muted">
          We deliver across Pakistan with Cash on Delivery, and exchanges are free for 14 days,
          because the right fit matters.
        </p>
      </div>
      <Link
        href="/shop"
        className="bg-ink mt-10 inline-flex h-11 items-center rounded-lg px-6 text-sm font-semibold text-white"
      >
        Shop the collection
      </Link>
    </Container>
  );
}
