import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's default palette. Register our custom
 * theme colours (see styles/theme.css) so that e.g. `text-white` and `text-ink`
 * are recognised as conflicting and the last one wins.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "ink",
        "muted",
        "line",
        "surface",
        "canvas",
        "success",
        "warning",
        "danger",
        { brand: ["50", "100", "500", "600", "700"] },
      ],
    },
  },
});

/** Merge class names, resolving Tailwind conflicts (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
