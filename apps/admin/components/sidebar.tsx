"use client";

import type { Role } from "@hoodie/types";
import { Badge, cn } from "@hoodie/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navForRole } from "@/lib/nav";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="border-line bg-canvas hidden w-64 shrink-0 flex-col border-r lg:flex">
      <div className="border-line flex h-16 items-center border-b px-6">
        <span className="font-black uppercase tracking-tight">Hoodie Admin</span>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto p-4">
        {navForRole(role).map((section) => (
          <div key={section.title}>
            <p className="text-muted px-2 text-xs font-semibold uppercase tracking-wider">
              {section.title}
            </p>
            <ul className="mt-2 space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const ready = item.phase === 0;
                return (
                  <li key={item.href}>
                    {ready ? (
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center rounded-lg px-2 py-1.5 text-sm font-medium",
                          active ? "bg-ink text-white" : "text-ink hover:bg-surface",
                        )}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        aria-disabled
                        title={`Built in Phase ${item.phase}`}
                        className="text-muted flex cursor-not-allowed items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                      >
                        {item.label}
                        <Badge>Soon</Badge>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
