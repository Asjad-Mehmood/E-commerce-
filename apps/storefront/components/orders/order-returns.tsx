"use client";

import type { ApiResponse, OrderDTO, ReturnDTO } from "@hoodie/types";
import { formatMoney, RETURN_REASON_LABEL, RETURN_STATUS_LABEL } from "@hoodie/types";
import { RETURN_REASONS } from "@hoodie/validation";
import { Badge, type BadgeProps, Button, Dialog, Field } from "@hoodie/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TONE: Record<ReturnDTO["status"], NonNullable<BadgeProps["tone"]>> = {
  REQUESTED: "warning",
  APPROVED: "brand",
  REJECTED: "danger",
  RECEIVED: "neutral",
  REFUNDED: "success",
};

const NEXT_STEP: Record<ReturnDTO["status"], string> = {
  REQUESTED: "We'll review your request within 2 working days and email you.",
  APPROVED: "Please send the items back. The address is in the email we sent you.",
  REJECTED: "",
  RECEIVED: "Your items arrived. Your refund is on its way.",
  REFUNDED: "",
};

function ReturnCard({ r }: { r: ReturnDTO }) {
  return (
    <li className="border-line rounded-xl border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Return requested {dateFmt.format(new Date(r.createdAt))}</p>
        <Badge tone={TONE[r.status]}>{RETURN_STATUS_LABEL[r.status]}</Badge>
      </div>
      <p className="text-muted mt-1">Reason: {RETURN_REASON_LABEL[r.reason] ?? r.reason}</p>
      <ul className="mt-2 space-y-0.5">
        {r.items.map((i) => (
          <li key={i.orderItemId}>
            {i.title} ({i.color}, {i.size}) × {i.quantity}
          </li>
        ))}
      </ul>
      {NEXT_STEP[r.status] && <p className="mt-2">{NEXT_STEP[r.status]}</p>}
      {r.status === "REJECTED" && r.adminNote && <p className="mt-2">{r.adminNote}</p>}
      {r.refundAmount != null && r.status === "REFUNDED" && (
        <p className="text-success mt-2 font-medium">Refunded {formatMoney(r.refundAmount)}</p>
      )}
    </li>
  );
}

function ReturnForm({
  order,
  qs,
  open,
  onClose,
  onDone,
}: {
  order: OrderDTO;
  qs: string;
  open: boolean;
  onClose: () => void;
  onDone: (o: OrderDTO) => void;
}) {
  // Units already in (non-declined) returns can't be returned again.
  const used = new Map<string, number>();
  for (const r of order.returns) {
    if (r.status === "REJECTED") continue;
    for (const i of r.items) used.set(i.orderItemId, (used.get(i.orderItemId) ?? 0) + i.quantity);
  }
  const items = order.items
    .map((i) => ({ ...i, left: i.quantity - (used.get(i.id) ?? 0) }))
    .filter((i) => i.left > 0);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<ApiResponse<OrderDTO>>(`/orders/${order.number}/returns${qs}`, { method: "POST", body }),
    onSuccess: ({ data }) => {
      toast.success("Return requested. We've emailed you the next steps.");
      onDone(data);
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? (Object.values(e.fieldErrors)[0]?.[0] ?? e.message)
          : "Couldn't send your request. Please try again.",
      ),
  });

  const chosen = Object.entries(qty).filter(([, n]) => n > 0);
  const send = () => {
    setError(null);
    if (!chosen.length) return setError("Choose at least one item to return.");
    if (!reason) return setError("Tell us why you're returning it.");
    if (reason === "other" && details.trim().length < 3)
      return setError("Tell us a little about the problem.");
    submit.mutate({
      items: chosen.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      reason,
      ...(details.trim() ? { details: details.trim() } : {}),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request a return"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={submit.isPending}>
            Send request
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        <p className="text-muted">
          Choose what you&apos;d like to return. Please don&apos;t post anything until we email you
          back with the address.
        </p>
        {error && (
          <p role="alert" className="bg-danger/10 text-danger rounded-lg p-3">
            {error}
          </p>
        )}
        <fieldset className="space-y-2">
          <legend className="font-medium">Items</legend>
          {items.map((i) => (
            <label
              key={i.id}
              className="border-line flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <span>
                <span className="block font-medium">{i.title}</span>
                <span className="text-muted">
                  {i.color} · {i.size}
                </span>
              </span>
              <select
                aria-label={`How many ${i.title} (${i.size}) to return`}
                value={qty[i.id] ?? 0}
                onChange={(e) => setQty((q) => ({ ...q, [i.id]: Number(e.target.value) }))}
                className="border-line bg-canvas h-9 rounded-lg border px-2"
              >
                {Array.from({ length: i.left + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Keep" : `Return ${n}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
        <Field label="Reason" htmlFor="return-reason">
          <select
            id="return-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border-line bg-canvas h-10 w-full rounded-lg border px-3"
          >
            <option value="">Choose a reason</option>
            {RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {RETURN_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={reason === "other" ? "Tell us more" : "Anything else? (optional)"}
          htmlFor="return-details"
          hint={
            reason === "wrong_size" ? "Want a different size instead? Say which one." : undefined
          }
        >
          <textarea
            id="return-details"
            value={details}
            maxLength={1000}
            rows={3}
            onChange={(e) => setDetails(e.target.value)}
            className="border-line bg-canvas focus:border-ink w-full rounded-lg border px-3 py-2 focus:outline-none"
          />
        </Field>
      </div>
    </Dialog>
  );
}

/** Return requests for an order, and the button to start one. */
export function OrderReturns({
  order,
  qs,
  onUpdated,
}: {
  order: OrderDTO;
  qs: string;
  onUpdated: (o: OrderDTO) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!order.returns.length && !order.canReturn) return null;

  return (
    <section aria-labelledby="returns-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="returns-heading" className="font-semibold">
          Returns
        </h3>
        {order.canReturn && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Request a return
          </Button>
        )}
      </div>
      {order.canReturn && order.returnBy && (
        <p className="text-muted mb-3 text-sm">
          You can request a return until {dateFmt.format(new Date(order.returnBy))}.
        </p>
      )}
      {order.returns.length > 0 && (
        <ul className="space-y-3">
          {order.returns.map((r) => (
            <ReturnCard key={r.id} r={r} />
          ))}
        </ul>
      )}
      {order.canReturn && (
        <ReturnForm
          key={order.returns.length}
          order={order}
          qs={qs}
          open={open}
          onClose={() => setOpen(false)}
          onDone={(o) => {
            setOpen(false);
            onUpdated(o);
          }}
        />
      )}
    </section>
  );
}
