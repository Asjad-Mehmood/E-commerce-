"use client";

import type { AdminOrderDTO, ApiResponse, OrderStatus } from "@hoodie/types";
import { Badge, Button, Dialog, Field, Input, Skeleton } from "@hoodie/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Checkbox, Textarea } from "@/components/ui/controls";
import { DetailList, ErrorState, PageHeader, Section } from "@/components/ui/page";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/status";
import { notificationsKey } from "@/hooks/use-notifications";
import { useCan } from "@/hooks/use-session";
import { api, ApiError, downloadFile, errorMessage } from "@/lib/api";
import { fromMinor, toMinor } from "@/lib/forms";
import { formatDateTime, formatMoney } from "@/lib/format";

type Order = AdminOrderDTO;

const orderKey = (number: string) => ["admin", "order", number] as const;

function useOrderMutation<T>(number: string, fn: (body: T) => Promise<Order>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      qc.setQueryData(orderKey(number), order);
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      void qc.invalidateQueries({ queryKey: notificationsKey });
    },
  });
}

const STEP_LABEL: Partial<Record<OrderStatus, string>> = {
  PROCESSING: "Start preparing",
  SHIPPED: "Mark as shipped",
  DELIVERED: "Mark as delivered",
};

// ───────────── Fulfilment ─────────────

function FulfilmentCard({ order }: { order: Order }) {
  const uid = useId();
  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [courier, setCourier] = useState(order.courier ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  const move = useOrderMutation(order.number, async (body: Record<string, unknown>) => {
    return (
      await api<ApiResponse<Order>>(`/admin/orders/${order.number}/status`, {
        method: "PATCH",
        body,
      })
    ).data;
  });

  const go = (status: OrderStatus, extra: Record<string, unknown> = {}, done?: () => void) =>
    move.mutate(
      { status, ...extra },
      {
        onSuccess: (o) => {
          toast.success(`Order ${o.number}: ${STEP_LABEL[status] ? "updated" : "cancelled"}`);
          done?.();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  const { nextStatuses, canCancel } = order.actions;
  const finished = nextStatuses.length === 0 && !canCancel;

  return (
    <Section title="Fulfilment">
      {finished ? (
        <p className="text-muted text-sm">
          {order.status === "DELIVERED"
            ? "Delivered. Nothing left to do."
            : order.status === "PENDING_PAYMENT"
              ? "Waiting for the customer to pay."
              : "This order is closed."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {nextStatuses.map((status) => (
            <Button
              key={status}
              loading={move.isPending && move.variables?.status === status}
              disabled={move.isPending}
              onClick={() => (status === "SHIPPED" ? setShipOpen(true) : go(status))}
            >
              {STEP_LABEL[status] ?? status}
            </Button>
          ))}
          {order.status === "PENDING_PAYMENT" && (
            <p className="text-muted text-sm">
              Waiting for card payment
              {order.payBy ? ` until ${formatDateTime(order.payBy)}` : ""}. Unpaid orders are
              cancelled automatically.
            </p>
          )}
          {canCancel && (
            <Button variant="outline" disabled={move.isPending} onClick={() => setCancelOpen(true)}>
              Cancel order
            </Button>
          )}
          {order.paymentMethod === "STRIPE" &&
            order.actions.canRefund &&
            ["PAID", "PROCESSING"].includes(order.status) && (
              <p className="text-muted text-xs">
                To cancel a paid card order, issue a full refund. The items go back into stock.
              </p>
            )}
        </div>
      )}

      <Dialog
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title={`Ship order ${order.number}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShipOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={move.isPending}
              onClick={() =>
                go(
                  "SHIPPED",
                  {
                    courier: courier.trim() || undefined,
                    trackingNumber: tracking.trim() || undefined,
                    note: note.trim() || undefined,
                  },
                  () => setShipOpen(false),
                )
              }
            >
              Mark as shipped
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-muted text-sm">
            The customer gets an email with the tracking details.
          </p>
          <Field label="Courier" htmlFor={`${uid}-courier`}>
            <Input
              id={`${uid}-courier`}
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="e.g. TCS, Leopards, M&P"
              list={`${uid}-couriers`}
            />
            <datalist id={`${uid}-couriers`}>
              {["TCS", "Leopards", "M&P", "PostEx", "Trax", "Pakistan Post"].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Tracking number" htmlFor={`${uid}-tracking`}>
            <Input
              id={`${uid}-tracking`}
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </Field>
          <Field label="Note (optional, internal)" htmlFor={`${uid}-ship-note`}>
            <Input id={`${uid}-ship-note`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel order ${order.number}?`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button
              variant="danger"
              loading={move.isPending}
              onClick={() =>
                go("CANCELLED", { note: reason.trim() || undefined }, () => setCancelOpen(false))
              }
            >
              Cancel order
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <p>
            The items go back into stock and the customer is emailed.
            {order.paymentMethod === "COD" && " No payment was collected, so nothing is refunded."}
          </p>
          <Field
            label="Reason (sent to the customer)"
            htmlFor={`${uid}-cancel-reason`}
            hint='Leave empty to say "Cancelled by the store."'
          >
            <Textarea
              id={`${uid}-cancel-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </Field>
        </div>
      </Dialog>
    </Section>
  );
}

// ───────────── Refund ─────────────

function RefundDialog({
  order,
  open,
  onClose,
}: {
  order: Order;
  open: boolean;
  onClose: () => void;
}) {
  const { refundable, refundMode, restockByDefault } = order.actions;
  const [amount, setAmount] = useState(fromMinor(refundable));
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(restockByDefault);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(fromMinor(refundable));
      setReason("");
      setRestock(restockByDefault);
      setError(null);
    }
  }, [open, refundable, restockByDefault]);

  const minor = toMinor(amount);
  const full = minor === refundable;
  const stockTaken = !["CANCELLED", "PENDING_PAYMENT"].includes(order.status);

  const refund = useOrderMutation(order.number, async (body: Record<string, unknown>) => {
    const res = await api<ApiResponse<{ order: Order }>>(`/admin/orders/${order.number}/refund`, {
      method: "POST",
      body,
    });
    return res.data.order;
  });

  const submit = () => {
    setError(null);
    if (minor === null || Number.isNaN(minor) || minor <= 0) return setError("Enter an amount");
    if (minor > refundable) return setError(`You can refund at most ${formatMoney(refundable)}`);
    if (reason.trim().length < 3) return setError("Give a short reason");
    refund.mutate(
      { amount: minor, reason: reason.trim(), restock: full && stockTaken ? restock : false },
      {
        onSuccess: () => {
          toast.success(`Refunded ${formatMoney(minor)}`);
          onClose();
        },
        onError: (err) =>
          setError(
            err instanceof ApiError
              ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message)
              : errorMessage(err),
          ),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Refund order ${order.number}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={refund.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={refund.isPending}>
            Refund {minor && !Number.isNaN(minor) ? formatMoney(minor) : ""}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          {refundMode === "card"
            ? "The money goes back to the customer's card through the payment provider. This can't be undone."
            : "Cash on Delivery: this records a refund you pay back yourself (cash or bank transfer). No money moves automatically."}
        </p>
        {error && (
          <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Field
          label="Amount (Rs)"
          htmlFor="refund-amount"
          hint={`Up to ${formatMoney(refundable)}${order.refundedTotal ? ` (already refunded ${formatMoney(order.refundedTotal)})` : ""}`}
        >
          <Input
            id="refund-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Reason" htmlFor="refund-reason" hint="Shown in the order history.">
          <Textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            className="min-h-16"
          />
        </Field>
        {stockTaken && (
          <Checkbox
            label="Put the items back in stock"
            hint={
              full
                ? restockByDefault
                  ? "The order hasn't shipped, so the items are still here."
                  : "Only if the customer has returned them."
                : "Only available for a full refund."
            }
            checked={full && restock}
            disabled={!full}
            onChange={(e) => setRestock(e.target.checked)}
          />
        )}
        {full && <p className="text-muted">A full refund marks the order as Refunded.</p>}
      </div>
    </Dialog>
  );
}

// ───────────── Notes & shipping details ─────────────

function NotesCard({ order }: { order: Order }) {
  const [notes, setNotes] = useState(order.adminNotes ?? "");
  useEffect(() => setNotes(order.adminNotes ?? ""), [order.adminNotes]);
  const save = useOrderMutation(
    order.number,
    async (body: Record<string, unknown>) =>
      (await api<ApiResponse<Order>>(`/admin/orders/${order.number}`, { method: "PATCH", body }))
        .data,
  );
  const dirty = notes.trim() !== (order.adminNotes ?? "");

  return (
    <Section title="Internal notes" description="Only staff see these.">
      {order.customerNote && (
        <div className="bg-surface rounded-lg p-3 text-sm">
          <p className="text-muted text-xs font-semibold uppercase">Customer note</p>
          <p className="mt-1 whitespace-pre-line">{order.customerNote}</p>
        </div>
      )}
      <Textarea
        aria-label="Internal notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2000}
        placeholder="e.g. Customer asked for delivery after 5 pm"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={!dirty}
        loading={save.isPending}
        onClick={() =>
          save.mutate(
            { adminNotes: notes },
            {
              onSuccess: () => toast.success("Notes saved"),
              onError: (err) => toast.error(errorMessage(err)),
            },
          )
        }
      >
        Save notes
      </Button>
    </Section>
  );
}

function ShipmentCard({ order }: { order: Order }) {
  const [editing, setEditing] = useState(false);
  const [courier, setCourier] = useState(order.courier ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const save = useOrderMutation(
    order.number,
    async (body: Record<string, unknown>) =>
      (await api<ApiResponse<Order>>(`/admin/orders/${order.number}`, { method: "PATCH", body }))
        .data,
  );
  const a = order.shippingAddress;

  return (
    <Section
      title="Delivery"
      actions={
        !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit tracking
          </Button>
        )
      }
    >
      <address className="text-sm not-italic leading-relaxed">
        <span className="font-medium">{a.fullName}</span>
        <br />
        {a.line1}
        {a.line2 && (
          <>
            <br />
            {a.line2}
          </>
        )}
        <br />
        {a.city}
        {a.state ? `, ${a.state}` : ""} {a.postalCode}
        <br />
        {a.phone}
      </address>
      {editing ? (
        <div className="space-y-3">
          <Field label="Courier" htmlFor="edit-courier">
            <Input id="edit-courier" value={courier} onChange={(e) => setCourier(e.target.value)} />
          </Field>
          <Field label="Tracking number" htmlFor="edit-tracking">
            <Input
              id="edit-tracking"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={save.isPending}
              onClick={() =>
                save.mutate(
                  { courier, trackingNumber: tracking },
                  {
                    onSuccess: () => {
                      toast.success("Tracking saved");
                      setEditing(false);
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                )
              }
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <DetailList
          items={[
            ["Method", order.shippingMethod],
            ["Courier", order.courier ?? "—"],
            ["Tracking", order.trackingNumber ?? "—"],
          ]}
        />
      )}
    </Section>
  );
}

// ───────────── Page ─────────────

export function OrderDetail({ number }: { number: string }) {
  const isManager = useCan("MANAGER");
  const [refundOpen, setRefundOpen] = useState(false);
  const [busyDoc, setBusyDoc] = useState<string | null>(null);
  const query = useQuery({
    queryKey: orderKey(number),
    queryFn: async () => (await api<ApiResponse<Order>>(`/admin/orders/${number}`)).data,
  });

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="space-y-4">
        <PageHeader title={`Order ${number}`} back={{ href: "/orders", label: "Orders" }} />
        <ErrorState
          message={notFound ? "There is no order with this number." : errorMessage(query.error)}
          onRetry={notFound ? undefined : () => void query.refetch()}
        />
      </div>
    );
  }

  const order = query.data;
  const openDoc = async (doc: "invoice" | "packing-slip") => {
    setBusyDoc(doc);
    try {
      await downloadFile(`/admin/orders/${order.number}/${doc}`, "open");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyDoc(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/orders", label: "Orders" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Order {order.number} <OrderStatusBadge status={order.status} />
          </span>
        }
        description={`Placed ${formatDateTime(order.placedAt)} · ${order.paymentMethod === "COD" ? "Cash on Delivery" : "Card"}`}
        actions={
          <>
            <Button
              variant="outline"
              loading={busyDoc === "packing-slip"}
              onClick={() => void openDoc("packing-slip")}
            >
              Packing slip
            </Button>
            <Button
              variant="outline"
              loading={busyDoc === "invoice"}
              onClick={() => void openDoc("invoice")}
            >
              Invoice
            </Button>
            {isManager && order.actions.canRefund && (
              <Button variant="danger" onClick={() => setRefundOpen(true)}>
                Refund
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* On phones the actions come first; on desktop they sit in the side column. */}
          <div className="lg:hidden">
            <FulfilmentCard order={order} />
          </div>
          <Section title={`Items (${order.items.reduce((n, i) => n + i.quantity, 0)})`}>
            <ul className="divide-line divide-y">
              {order.items.map((item) => (
                <li key={item.sku} className="flex gap-3 py-3 first:pt-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- product photos from any image host
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="bg-surface size-14 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="bg-surface size-14 rounded-lg" />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted">
                      {item.color} / {item.size} · {item.sku}
                    </p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p>
                      {item.quantity} × {formatMoney(item.unitPrice)}
                    </p>
                    <p className="font-medium">{formatMoney(item.lineTotal)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="border-line space-y-1.5 border-t pt-4 text-sm tabular-nums">
              {(
                [
                  ["Subtotal", order.subtotal],
                  order.discountTotal
                    ? [
                        `Discount${order.couponCode ? ` (${order.couponCode})` : ""}`,
                        -order.discountTotal,
                      ]
                    : null,
                  [order.shippingMethod, order.shippingTotal],
                  order.codFee ? ["Cash on Delivery fee", order.codFee] : null,
                  order.taxTotal ? ["Tax", order.taxTotal] : null,
                ].filter(Boolean) as [string, number][]
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-muted">{label}</dt>
                  <dd>{formatMoney(value)}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(order.grandTotal)}</dd>
              </div>
              {order.refundedTotal > 0 && (
                <div className="text-danger flex justify-between">
                  <dt>Refunded</dt>
                  <dd>−{formatMoney(order.refundedTotal)}</dd>
                </div>
              )}
            </dl>
          </Section>

          <Section title="Payment">
            {order.payments.length === 0 ? (
              <p className="text-muted text-sm">No payment recorded.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">
                        {p.method === "COD" ? "Cash on Delivery" : "Card"}
                      </span>{" "}
                      <PaymentStatusBadge status={p.status} />
                      {p.providerRef && (
                        <span className="text-muted block font-mono text-xs">{p.providerRef}</span>
                      )}
                      {p.failureReason && p.status !== "SUCCEEDED" && (
                        <span className="text-danger block text-xs">{p.failureReason}</span>
                      )}
                    </span>
                    <span className="tabular-nums">{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {order.refunds.length > 0 && (
              <div className="border-line border-t pt-4">
                <h3 className="text-sm font-semibold">Refunds</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {order.refunds.map((r) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      <span>
                        {r.reason}
                        <span className="text-muted block text-xs">
                          {formatDateTime(r.createdAt)}
                          {r.by ? ` · ${r.by}` : ""}
                          {r.providerRef ? ` · ${r.providerRef}` : " · recorded manually"}
                          {r.restocked ? " · restocked" : ""}
                        </span>
                      </span>
                      <span className="text-danger tabular-nums">−{formatMoney(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="History">
            <ol className="border-line space-y-4 border-l pl-5">
              {[...order.timeline].reverse().map((e, i) => (
                <li key={`${e.at}-${i}`} className="relative text-sm">
                  <span className="bg-ink ring-canvas absolute -left-[25px] top-1.5 size-2 rounded-full ring-4" />
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={e.status} />
                    <span className="text-muted text-xs">
                      {formatDateTime(e.at)} · {e.by ?? "Customer / system"}
                    </span>
                  </div>
                  {e.note && <p className="mt-1">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="space-y-6">
          <div className="hidden lg:block">
            <FulfilmentCard order={order} />
          </div>
          <Section title="Customer">
            <DetailList
              items={[
                ["Name", order.shippingAddress.fullName],
                [
                  "Email",
                  <a key="e" href={`mailto:${order.email}`} className="underline">
                    {order.email}
                  </a>,
                ],
                [
                  "Phone",
                  <a key="p" href={`tel:${order.phone}`} className="underline">
                    {order.phone}
                  </a>,
                ],
                [
                  "Account",
                  order.customer ? (
                    <Link key="c" href={`/customers/${order.customer.id}`} className="underline">
                      {order.customer.name} · {order.customer.orderCount} order
                      {order.customer.orderCount === 1 ? "" : "s"}
                    </Link>
                  ) : (
                    <Badge key="g">Guest checkout</Badge>
                  ),
                ],
              ]}
            />
          </Section>
          <ShipmentCard order={order} />
          <NotesCard order={order} />
        </div>
      </div>

      {isManager && order.actions.canRefund && (
        <RefundDialog order={order} open={refundOpen} onClose={() => setRefundOpen(false)} />
      )}
    </div>
  );
}
