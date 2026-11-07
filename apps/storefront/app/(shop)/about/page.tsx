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
        <p>
          Urban Store started in Lahore with a simple idea: everyday hoodies that feel as good as
          the imported ones, at prices that make sense in Pakistan.
        </p>
        <p className="text-muted">
          Every piece is cut from 300–450 GSM cotton fleece and finished with double-lined hoods,
          ribbed cuffs and stitching that survives the wash. We make in small batches with local
          workshops, so when a colour sells out it may not come back.
        </p>
        <p className="text-muted">
          Want something that&apos;s only yours? Our custom embroidered hoodie carries your name or
          initials, stitched in our workshop.
        </p>
        <p className="text-muted">
          We deliver to every city in Pakistan with Cash on Delivery, and size exchanges are free
          for 14 days, because the right fit matters.
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
