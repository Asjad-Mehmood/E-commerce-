import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "border-line bg-canvas text-ink h-10 w-full rounded-lg border px-3 text-sm",
        "placeholder:text-muted focus:border-ink focus:ring-ink/10 focus:outline-none focus:ring-2",
        "disabled:bg-surface disabled:opacity-60",
        invalid && "border-danger focus:border-danger focus:ring-danger/15",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-ink text-sm font-medium", className)} {...props} />;
}
