"use client";

import { hasRole, isAdminRole } from "@hoodie/types";
import { Button, Dialog, Skeleton } from "@hoodie/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { useLogout, useSession } from "@/hooks/use-session";
import { minRoleFor } from "@/lib/nav";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";

function Brand() {
  return (
    <Link href="/" className="font-black uppercase tracking-tight">
      Hoodie Admin
    </Link>
  );
}

function FullScreenMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="bg-surface flex min-h-dvh items-center justify-center p-6">
      <div className="border-line bg-canvas w-full max-w-md rounded-2xl border p-8 text-center">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="text-muted mt-2 text-sm">{children}</div>
      </div>
    </main>
  );
}

/** Signed-in staff layout. Guests go to /login; customers see a "no access" page. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { data: user, isPending, isError, refetch } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !isError && !user) {
      const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
      router.replace(`/login${next}`);
    }
  }, [isPending, isError, user, pathname, router]);

  if (isError) {
    return (
      <FullScreenMessage title="Can't reach the store">
        <p>The admin panel could not connect to the API.</p>
        <Button className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </FullScreenMessage>
    );
  }
  if (isPending || !user) {
    return (
      <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading">
        <div className="border-line hidden w-64 border-r p-4 lg:block">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  if (!isAdminRole(user.role)) {
    return (
      <FullScreenMessage title="No admin access">
        <p>
          You&apos;re signed in as {user.email}, which is a customer account. Sign in with a staff
          account to use the admin panel.
        </p>
        <Button
          className="mt-4"
          loading={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login") })}
        >
          Sign out
        </Button>
      </FullScreenMessage>
    );
  }

  return (
    <StaffLayout
      user={user}
      onMenu={() => setMenuOpen(true)}
      menuOpen={menuOpen}
      closeMenu={() => setMenuOpen(false)}
    >
      {children}
    </StaffLayout>
  );
}

function StaffLayout({
  user,
  menuOpen,
  onMenu,
  closeMenu,
  children,
}: {
  user: NonNullable<ReturnType<typeof useSession>["data"]>;
  menuOpen: boolean;
  onMenu: () => void;
  closeMenu: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { data: counts } = useNotifications();
  const allowed = hasRole(user.role, minRoleFor(pathname));

  return (
    <div className="bg-surface flex min-h-dvh">
      <a
        href="#main"
        className="bg-ink sr-only z-50 rounded px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <aside className="border-line bg-canvas sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="border-line flex h-16 shrink-0 items-center border-b px-6">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={user.role} counts={counts} />
        </div>
      </aside>
      <Dialog open={menuOpen} onClose={closeMenu} title="Menu" variant="left" className="lg:hidden">
        <div className="-mx-5 -my-4">
          <SidebarNav role={user.role} counts={counts} onNavigate={closeMenu} />
        </div>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} counts={counts} onMenu={onMenu} />
        <main id="main" className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {allowed ? (
              children
            ) : (
              <div className="border-line bg-canvas rounded-(--radius-card) border p-8 text-center">
                <h1 className="text-xl font-bold">You don&apos;t have access to this page</h1>
                <p className="text-muted mt-2 text-sm">
                  Ask a Super Admin if you need it for your work.
                </p>
                <Link href="/" className="mt-4 inline-block text-sm font-medium underline">
                  Back to the dashboard
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
