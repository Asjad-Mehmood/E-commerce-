import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

const tones = {
  neutral: "bg-surface text-ink border-line",
  brand: "bg-brand-50 text-brand-700 border-brand-100",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/15 text-ink border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/20",
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof tones;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
