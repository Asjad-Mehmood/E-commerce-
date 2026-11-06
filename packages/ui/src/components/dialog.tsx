"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (it is still announced to screen readers). */
  hideTitle?: boolean;
  /** `center` = modal, `right` / `left` = slide-in drawer. */
  variant?: "center" | "right" | "left";
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const variants = {
  center: "m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl max-h-[85dvh]",
  right: "ml-auto mr-0 my-0 h-dvh max-h-dvh w-full max-w-md",
  left: "mr-auto ml-0 my-0 h-dvh max-h-dvh w-full max-w-sm",
} as const;

/**
 * Accessible modal / drawer built on the native <dialog> element, which gives
 * focus trapping, Escape-to-close and an inert background for free.
 */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle,
  variant = "center",
  className,
  children,
  footer,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "bg-canvas text-ink flex-col p-0 shadow-2xl backdrop:bg-black/50 open:flex",
        variants[variant],
        className,
      )}
    >
      <div className="border-line flex items-center justify-between gap-4 border-b px-5 py-4">
        <h2 id={titleId} className={cn("text-lg font-semibold", hideTitle && "sr-only")}>
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hover:bg-surface -mr-2 ml-auto rounded-lg p-2"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="border-line border-t px-5 py-4">{footer}</div>}
    </dialog>
  );
}
