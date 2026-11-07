import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div>
        <p className="text-muted text-sm font-semibold">404</p>
        <h1 className="mt-1 text-2xl font-bold">Page not found</h1>
        <Link href="/" className="mt-4 inline-block text-sm font-medium underline">
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
