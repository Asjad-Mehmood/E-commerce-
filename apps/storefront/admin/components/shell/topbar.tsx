"use client";

import type { AdminNotificationsDTO, AuthUser } from "@hoodie/types";
import { Button } from "@hoodie/ui";
import Link from "@/admin/lib/link";
import { useRouter } from "@/admin/lib/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLogout } from "@/admin/hooks/use-session";
import { adminConfig } from "@/admin/lib/config";

const ROLE_LABEL = { SUPPORT: "Support", MANAGER: "Manager", SUPER_ADMIN: "Super Admin" } as const;

/** A button that opens a small panel; closes on outside click or Escape. */
function Popover({
  label,
  button,
  children,
}: {
  /** Accessible name; leave out when the button's own text names it. */
  label?: string;
  button: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-surface relative flex h-10 items-center gap-2 rounded-lg px-2"
      >
        {button}
      </button>
      {open && (
        <div className="border-line bg-canvas absolute right-0 top-12 z-30 w-72 rounded-xl border p-2 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function Topbar({
  user,
  counts,
  onMenu,
}: {
  user: AuthUser;
  counts?: AdminNotificationsDTO;
  onMenu: () => void;
}) {
  const router = useRouter();
  const logout = useLogout();
  const [q, setQ] = useState("");
  const isManagerRole = user.role !== "SUPPORT";
  const total =
    (counts?.toFulfil ?? 0) +
    (counts?.newMessages ?? 0) +
    (counts?.pendingReturns ?? 0) +
    (counts?.pendingReviews ?? 0) +
    (isManagerRole ? (counts?.lowStock ?? 0) : 0);
  const isManager = user.role !== "SUPPORT";

  const alerts = [
    {
      n: counts?.toFulfil ?? 0,
      text: "orders to fulfil",
      href: "/orders?status=CONFIRMED,PAID,PROCESSING",
      show: true,
    },
    { n: counts?.newMessages ?? 0, text: "new messages", href: "/messages?status=NEW", show: true },
    {
      n: counts?.pendingReturns ?? 0,
      text: "return requests",
      href: "/returns?status=REQUESTED",
      show: true,
    },
    { n: counts?.pendingReviews ?? 0, text: "reviews to moderate", href: "/reviews", show: true },
    {
      n: counts?.lowStock ?? 0,
      text: "variants low on stock",
      href: "/inventory?stock=low",
      show: isManager,
    },
  ].filter((a) => a.show);

  return (
    <header className="border-line bg-canvas sticky top-0 z-20 flex h-16 items-center gap-2 border-b px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open menu"
        onClick={onMenu}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </Button>

      <form
        role="search"
        className="hidden min-w-0 flex-1 sm:block"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/orders?q=${encodeURIComponent(q.trim())}`);
          setQ("");
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find an order by number, email or phone"
          aria-label="Find an order"
          className="border-line bg-surface focus:border-ink focus:ring-ink/10 h-10 w-full max-w-md rounded-lg border px-3 text-sm focus:outline-none focus:ring-2"
        />
      </form>
      <div className="flex-1 sm:hidden" />

      <Popover
        label={total ? `Notifications: ${total > 99 ? "99+" : total}` : "Notifications"}
        button={
          <>
            <BellIcon />
            {total > 0 && (
              <span className="bg-brand-600 absolute right-0.5 top-1 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4 text-white">
                {total > 99 ? "99+" : total}
              </span>
            )}
          </>
        }
      >
        {(close) => (
          <ul className="text-sm">
            {alerts.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  onClick={close}
                  className="hover:bg-surface flex items-center justify-between rounded-lg px-3 py-2"
                >
                  <span>
                    <span className="font-semibold tabular-nums">{a.n}</span> {a.text}
                  </span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
            {total === 0 && <li className="text-muted px-3 py-2">You&apos;re all caught up.</li>}
          </ul>
        )}
      </Popover>

      <Popover
        button={
          <>
            <span className="sr-only">Account menu: </span>
            <span
              aria-hidden
              className="bg-ink flex size-8 items-center justify-center rounded-full text-sm font-semibold uppercase text-white"
            >
              {user.name.slice(0, 1)}
            </span>
            <span className="hidden text-left text-sm leading-tight md:block">
              <span className="block font-medium">{user.name}</span>
              <span className="text-muted block text-xs">
                {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL]}
              </span>
            </span>
          </>
        }
      >
        {(close) => (
          <div className="text-sm">
            <p className="border-line border-b px-3 pb-2 pt-1">
              <span className="block font-medium">{user.name}</span>
              <span className="text-muted block truncate">{user.email}</span>
            </p>
            <a
              href={adminConfig.storefrontUrl || "/"}
              target="_blank"
              rel="noreferrer"
              onClick={close}
              className="hover:bg-surface mt-1 block rounded-lg px-3 py-2"
            >
              View store ↗
            </a>
            <button
              type="button"
              className="hover:bg-surface block w-full rounded-lg px-3 py-2 text-left"
              onClick={() =>
                logout.mutate(undefined, { onSettled: () => router.replace("/login") })
              }
            >
              Sign out
            </button>
          </div>
        )}
      </Popover>
    </header>
  );
}
