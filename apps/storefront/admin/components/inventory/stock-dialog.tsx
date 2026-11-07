"use client";

import type { AdminVariantDTO, ApiResponse, StockAdjustmentDTO } from "@hoodie/types";
import { STOCK_ADJUSTMENT_REASONS } from "@hoodie/validation";
import { Button, Dialog, Field, Input } from "@hoodie/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Select } from "@/admin/components/ui/controls";
import { notificationsKey } from "@/admin/hooks/use-notifications";
import { api, ApiError, errorMessage } from "@/admin/lib/api";
import { formatDateTime } from "@/admin/lib/format";

const REASON_LABEL: Record<(typeof STOCK_ADJUSTMENT_REASONS)[number], string> = {
  restock: "Restock (new delivery)",
  damaged: "Damaged",
  lost: "Lost or stolen",
  returned: "Returned by customer",
  correction: "Stock count correction",
};

export interface StockTarget {
  variantId: string;
  label: string;
  stock: number;
  reserved: number;
}

/** Add or remove units with a reason, and see the variant's adjustment history. */
export function StockDialog({
  target,
  onClose,
  onSaved,
}: {
  target: StockTarget | null;
  onClose: () => void;
  onSaved?: (variant: AdminVariantDTO) => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"add" | "remove" | "set">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<(typeof STOCK_ADJUSTMENT_REASONS)[number]>("restock");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setMode("add");
      setAmount("");
      setReason("restock");
      setNote("");
      setError(null);
    }
  }, [target]);

  const history = useQuery({
    queryKey: ["admin", "stock-history", target?.variantId],
    queryFn: async () =>
      (
        await api<ApiResponse<StockAdjustmentDTO[]>>(
          `/admin/inventory/${target!.variantId}/history`,
        )
      ).data,
    enabled: !!target,
  });

  const n = Number.parseInt(amount, 10);
  const change =
    !target || Number.isNaN(n) ? 0 : mode === "add" ? n : mode === "remove" ? -n : n - target.stock;
  const after = target ? target.stock + change : 0;

  const save = useMutation({
    mutationFn: async () =>
      (
        await api<ApiResponse<AdminVariantDTO>>(
          `/admin/variants/${target!.variantId}/adjust-stock`,
          {
            method: "POST",
            body: { change, reason, note: note.trim() || undefined },
          },
        )
      ).data,
    onSuccess: (variant) => {
      toast.success(`Stock for ${target!.label} is now ${variant.stock}`);
      void qc.invalidateQueries({ queryKey: ["admin", "inventory"] });
      void qc.invalidateQueries({ queryKey: ["admin", "stock-history", target!.variantId] });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: notificationsKey });
      onSaved?.(variant);
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : errorMessage(err)),
  });

  const submit = () => {
    setError(null);
    if (Number.isNaN(n) || n < 0 || (mode !== "set" && n === 0))
      return setError("Enter a number of units");
    if (change === 0) return setError("That is already the stock level");
    if (target && after < target.reserved) {
      return setError(
        `${target.reserved} unit(s) are held by unpaid orders, so stock can't go below ${target.reserved}.`,
      );
    }
    save.mutate();
  };

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={target ? `Adjust stock: ${target.label}` : "Adjust stock"}
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted text-sm tabular-nums">
            {target?.stock} → <span className="text-ink font-semibold">{after}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={save.isPending}>
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {target && target.reserved > 0 && (
          <p className="bg-surface rounded-lg px-3 py-2 text-sm">
            {target.reserved} of {target.stock} units are held by orders awaiting card payment.
          </p>
        )}
        <div role="radiogroup" aria-label="Adjustment" className="grid grid-cols-3 gap-2">
          {(
            [
              ["add", "Add"],
              ["remove", "Remove"],
              ["set", "Set to"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => {
                setMode(value);
                if (value === "add") setReason("restock");
                else if (value === "remove" && reason === "restock") setReason("damaged");
                else if (value === "set") setReason("correction");
              }}
              className={
                mode === value
                  ? "bg-ink rounded-lg py-2 text-sm font-medium text-white"
                  : "border-line hover:bg-surface rounded-lg border py-2 text-sm"
              }
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">
            {error}
          </p>
        )}
        <Field label={mode === "set" ? "New stock level" : "Units"} htmlFor="stock-units">
          <Input
            id="stock-units"
            type="number"
            min={0}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </Field>
        <Field label="Reason" htmlFor="stock-reason">
          <Select
            id="stock-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
          >
            {STOCK_ADJUSTMENT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note (optional)" htmlFor="stock-note">
          <Input
            id="stock-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="e.g. Supplier invoice #1042"
          />
        </Field>

        <div className="border-line border-t pt-4">
          <h3 className="text-sm font-semibold">History</h3>
          {history.data?.length === 0 && (
            <p className="text-muted mt-2 text-sm">No adjustments yet.</p>
          )}
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
            {history.data?.map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                <span>
                  {REASON_LABEL[h.reason as keyof typeof REASON_LABEL] ?? h.reason}
                  {h.note && <span className="text-muted"> · {h.note}</span>}
                  <span className="text-muted block text-xs">
                    {formatDateTime(h.createdAt)}
                    {h.by ? ` · ${h.by}` : ""}
                  </span>
                </span>
                <span
                  className={`font-medium tabular-nums ${h.change > 0 ? "text-success" : "text-danger"}`}
                >
                  {h.change > 0 ? `+${h.change}` : h.change}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
