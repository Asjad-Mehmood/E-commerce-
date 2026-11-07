import type { SVGProps } from "react";
import { cn } from "../lib/cn";

/** Urban Store mark: a hood with two drawstrings, on an ink tile. */
export function LogoMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)} {...props}>
      <rect width="32" height="32" rx="8" fill="#16181d" />
      <path d="M6.5 24C6.5 13.5 10.6 6 16 6s9.5 7.5 9.5 18Z" fill="#fff" />
      <path d="M11.4 24c0-7.4 2-11.6 4.6-11.6s4.6 4.2 4.6 11.6Z" fill="#16181d" />
      <path d="M12.6 22.5v5M19.4 22.5v5" stroke="#e2622b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + "URBAN STORE" wordmark. `label` adds a small suffix such as "Admin". */
export function Logo({
  className,
  label,
  markClassName,
}: {
  className?: string;
  label?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="whitespace-nowrap text-lg font-black uppercase leading-none tracking-tight">
        Urban Store
        {label && (
          <span className="text-muted ml-1.5 text-xs font-semibold normal-case tracking-normal">
            {label}
          </span>
        )}
      </span>
    </span>
  );
}
