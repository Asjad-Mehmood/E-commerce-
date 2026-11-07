import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

/** Placeholder block shown while content loads. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn("bg-line/70 animate-pulse rounded-lg", className)} {...props} />
  );
}
