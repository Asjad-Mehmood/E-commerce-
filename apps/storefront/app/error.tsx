"use client";

import { Button, Container } from "@hoodie/ui";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-32 text-center">
      <p className="text-brand-600 text-sm font-semibold">Something went wrong</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">We couldn’t load this page</h1>
      <p className="text-muted mt-3">Please try again in a moment.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/"
          className="border-line inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Go home
        </Link>
      </div>
    </Container>
  );
}
