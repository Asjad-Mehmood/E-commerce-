"use client";

import { cn } from "@hoodie/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";

interface ListingNav {
  /** Applies URL param changes (null removes a param) and resets to page 1. */
  update: (changes: Record<string, string | null>) => void;
  params: URLSearchParams;
  isPending: boolean;
}

const Ctx = createContext<ListingNav | null>(null);

export function ListingNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  // Controls read these optimistic params, so a tick or click shows immediately
  // instead of waiting for the server round-trip that updates the URL.
  const [optimistic, setOptimistic] = useState(() => searchParams.toString());
  useEffect(() => setOptimistic(searchParams.toString()), [searchParams]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(optimistic);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    setOptimistic(qs);
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <Ctx.Provider value={{ update, params: new URLSearchParams(optimistic), isPending }}>
      {children}
    </Ctx.Provider>
  );
}

export function useListingNav(): ListingNav {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useListingNav must be used inside ListingNavProvider");
  return ctx;
}

/** Dims the results while a filter change is loading. */
export function ResultsArea({ children }: { children: ReactNode }) {
  const { isPending } = useListingNav();
  return (
    <div
      aria-busy={isPending}
      className={cn("transition-opacity", isPending && "pointer-events-none opacity-50")}
    >
      {children}
    </div>
  );
}
