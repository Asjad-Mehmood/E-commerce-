import { Container } from "@hoodie/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <Container className="py-32 text-center">
      <p className="text-brand-600 text-sm font-semibold">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">We couldn’t find that page</h1>
      <p className="text-muted mt-3">
        It may have moved, or the hoodie may no longer be available.
      </p>
      <Link
        href="/"
        className="bg-ink mt-8 inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-white"
      >
        Back to home
      </Link>
      <Link
        href="/shop"
        className="border-line ml-3 inline-flex h-11 items-center rounded-lg border px-5 text-sm font-semibold"
      >
        Shop hoodies
      </Link>
    </Container>
  );
}
