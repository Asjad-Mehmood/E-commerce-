"use client";

import { Button, Dialog } from "@hoodie/ui";
import type { ReactNode } from "react";

/** A yes/no dialog for destructive or important actions. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  tone = "primary",
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-sm leading-relaxed">{children}</div>
    </Dialog>
  );
}
