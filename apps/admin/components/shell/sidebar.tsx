"use client";

import type { AdminNotificationsDTO, Role } from "@hoodie/types";
import { Badge, cn } from "@hoodie/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeItem, BUILT_PHASE, navForRole, type NavItem } from "@/lib/nav";

const BADGE_SR: Record<NonNullable<NavItem["badge"]>, string> = {
  toFulfil: " to fulfil)",
  newMessages: " new)",
  lowStock: " low on stock)",
  pendingReturns: " waiting for a decision)",
  pendingReviews: " to moderate)",
};

export function SidebarNav({
  role,
  counts,
  onNavigate,
}: {
  role: Role;
  counts?: AdminNotificationsDTO;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = activeItem(pathname);

  return (
    <nav aria-label="Admin" className="space-y-6 p-4">
      {navForRole(role).map((section) => (
        <div key={section.title}>
          <p className="text-muted px-2 text-xs font-semibold uppercase tracking-wider">
            {section.title}
          </p>
          <ul className="mt-2 space-y-0.5">
            {section.items.map((item) => {
              const isActive = active?.href === item.href;
              const count = item.badge ? (counts?.[item.badge] ?? 0) : 0;
              if (item.phase > BUILT_PHASE) {
                return (
                  <li key={item.href}>
                    <span
                      aria-disabled
                      title={`Coming in Phase ${item.phase}`}
                      className="text-muted flex cursor-not-allowed items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                    >
                      {item.label}
                      <Badge>Soon</Badge>
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium",
                      isActive ? "bg-ink text-white" : "text-ink hover:bg-surface",
                    )}
                  >
                    {item.label}
                    {count > 0 && (
                      <span
                        className={cn(
                          "min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums",
                          isActive
                            ? "bg-white/20 text-white"
                            : item.badge === "lowStock"
                              ? "bg-warning/25 text-ink"
                              : "bg-brand-600 text-white",
                        )}
                      >
                        <span className="sr-only">(</span>
                        {count > 99 ? "99+" : count}
                        <span className="sr-only">{BADGE_SR[item.badge!]}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
