import { Container } from "@hoodie/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <Container className="py-32 text-center">
      <p className="text-brand-600 text-sm font-semibold">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">This page is still being stitched</h1>
      <p className="text-muted mt-3">The page you are looking for does not exist yet.</p>
      <Link
        href="/"
        className="bg-ink mt-8 inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold text-white"
      >
        Back to home
      </Link>
    </Container>
  );
}
