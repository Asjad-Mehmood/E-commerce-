"use client";

import { Container, cn, Skeleton } from "@hoodie/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { useLogout, useMe } from "@/hooks/use-auth";

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/profile", label: "Profile & password" },
  { href: "/account/addresses", label: "Addresses" },
];

/** Account area: redirects guests to sign in, then shows the account navigation. */
export function AccountShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  // Signing out clears the session, which would otherwise trigger the
  // "guests must sign in" redirect below instead of going home.
  const signingOut = useRef(false);

  useEffect(() => {
    if (me.isFetched && !me.data && !signingOut.current)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [me.isFetched, me.data, pathname, router]);

  if (!me.data) {
    return (
      <Container className="py-12">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-8 h-48" />
      </Container>
    );
  }

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight">My account</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Account">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={cn(
                    "block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                    pathname === item.href ? "bg-ink text-white" : "hover:bg-surface",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  signingOut.current = true;
                  logout.mutate(undefined, {
                    onSuccess: () => {
                      toast.success("You've been signed out");
                      router.push("/");
                    },
                    onError: () => {
                      signingOut.current = false;
                      toast.error("Could not sign out. Please try again.");
                    },
                  });
                }}
                className="text-muted hover:bg-surface hover:text-ink block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium"
              >
                Sign out
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
