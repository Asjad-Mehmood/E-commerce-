"use client";

import type {
  AdminReturnDTO,
  AdminReturnListItemDTO,
  ApiResponse,
  PaginatedResponse,
  ReturnStatus,
} from "@hoodie/types";
import { RETURN_REASON_LABEL, RETURN_STATUS_LABEL } from "@hoodie/types";
import { Badge, type BadgeProps, Button, Dialog, Field, Input, Skeleton } from "@hoodie/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox, Textarea } from "@/components/ui/controls";
import { FilterTabs } from "@/components/ui/filters";
import { DetailList, ErrorState, PageHeader, Section } from "@/components/ui/page";
import { OrderStatusBadge } from "@/components/ui/status";
import { LoadingRows, Pagination, Table, TableMessage, Td, Th, Tr } from "@/components/ui/table";
import { notificationsKey } from "@/hooks/use-notifications";
import { useCan } from "@/hooks/use-session";
import { useUrlState } from "@/hooks/use-url-state";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDateTime, formatMoney, timeAgo } from "@/lib/format";
import { fromMinor, toMinor } from "@/lib/forms";

const TONE: Record<ReturnStatus, NonNullable<BadgeProps["tone"]>> = {
  REQUESTED: "warning",
  APPROVED: "brand",
  REJECTED: "danger",
  RECEIVED: "neutral",
  REFUNDED: "success",
};
/** Staff-facing labels (the customer sees "Approved: send it back"). */
const LABEL: Record<ReturnStatus, string> = {
  ...RETURN_STATUS_LABEL,
  APPROVED: "Approved, awaiting parcel",
  REJECTED: "Declined",
};
export const ReturnBadge = ({ status }: { status: ReturnStatus }) => (
  <Badge tone={TONE[status]}>{LABEL[status]}</Badge>
);

export function ReturnsList() {
  const router = useRouter();
  const { values, set, query } = useUrlState<"status">();
  const params = new URLSearchParams(query);
  if (!params.has("status")) params.set("status", "open");
  const list = useQuery({
    queryKey: ["admin", "returns", params.toString()],
    queryFn: () =>
      api<PaginatedResponse<AdminReturnListItemDTO>>(`/admin/returns?limit=25&${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Returns"
        description="Customers ask from their order page within the return window. Approve to send them the return address, mark the parcel received, then refund."
      />
      <FilterTabs
        label="Return status"
        value={values.status ?? "open"}
        onChange={(status) => set({ status: status === "open" ? "" : status })}
        options={[
          { value: "open", label: "In progress" },
          { value: "REQUESTED", label: "To review" },
          { value: "APPROVED", label: "Awaiting parcel" },
          { value: "RECEIVED", label: "To refund" },
          { value: "REFUNDED", label: "Refunded" },
          { value: "REJECTED", label: "Declined" },
        ]}
      />
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      <Table className={list.isPlaceholderData ? "opacity-60" : undefined}>
        <thead>
          <tr>
            <Th>Requested</Th>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Reason</Th>
            <Th className="text-right">Items</Th>
            <Th className="text-right">Value</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {list.isPending ? (
            <LoadingRows cols={7} />
          ) : list.data?.data.length === 0 ? (
            <TableMessage cols={7}>No returns here.</TableMessage>
          ) : (
            list.data?.data.map((r) => (
              <Tr
                key={r.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("a")) router.push(`/returns/${r.id}`);
                }}
              >
                <Td className="text-muted whitespace-nowrap" title={formatDateTime(r.createdAt)}>
                  <Link href={`/returns/${r.id}`} className="hover:underline">
                    {timeAgo(r.createdAt)}
                  </Link>
                </Td>
                <Td className="font-medium">{r.orderNumber}</Td>
                <Td>
                  <span className="block">{r.customerName}</span>
                  <span className="text-muted">{r.email}</span>
                </Td>
                <Td>{RETURN_REASON_LABEL[r.reason] ?? r.reason}</Td>
                <Td className="text-right tabular-nums">{r.itemCount}</Td>
                <Td className="text-right tabular-nums">{formatMoney(r.itemsValue)}</Td>
                <Td>
                  <ReturnBadge status={r.status} />
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
      <Pagination meta={list.data?.meta} onPage={(page) => set({ page })} label="returns" />
    </div>
  );
}

type Action = "approve" | "reject" | "receive" | "refund";

export function ReturnDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const isManager = useCan("MANAGER");
  const key = ["admin", "return", id];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await api<ApiResponse<AdminReturnDTO>>(`/admin/returns/${id}`)).data,
  });
  const [dialog, setDialog] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: async ({ action, body }: { action: Action; body: Record<string, unknown> }) =>
      (
        await api<ApiResponse<AdminReturnDTO>>(`/admin/returns/${id}/${action}`, {
          method: "POST",
          body,
        })
      ).data,
    onSuccess: (r, { action }) => {
      qc.setQueryData(key, r);
      void qc.invalidateQueries({ queryKey: ["admin", "returns"] });
      void qc.invalidateQueries({ queryKey: notificationsKey });
      void qc.invalidateQueries({ queryKey: ["admin", "order", r.order.number] });
      toast.success(
        {
          approve: "Approved. The customer was emailed the return address.",
          reject: "Declined. The customer was emailed.",
          receive: "Marked as received.",
          refund: `Refunded ${formatMoney(r.refundAmount ?? 0)}.`,
        }[action],
      );
      setDialog(null);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? (Object.values(err.fieldErrors)[0]?.[0] ?? err.message)
          : errorMessage(err),
      ),
  });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Return" back={{ href: "/returns", label: "Returns" }} />
        <ErrorState message={errorMessage(query.error)} />
      </div>
    );
  }
  const r = query.data;
  const open = (action: Action) => {
    setError(null);
    setNote("");
    setRestock(true);
    setAmount(fromMinor(r.suggestedRefund));
    setDialog(action);
  };
  const submit = () => {
    setError(null);
    if (dialog === "reject" && note.trim().length < 3) return setError("Tell the customer why.");
    if (dialog === "refund") {
      const minor = toMinor(amount);
      if (minor === null || Number.isNaN(minor) || minor <= 0) return setError("Enter an amount.");
      return act.mutate({
        action: "refund",
        body: { amount: minor, ...(note.trim() ? { note: note.trim() } : {}) },
      });
    }
    act.mutate({
      action: dialog!,
      body: {
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(dialog === "receive" ? { restock } : {}),
      },
    });
  };

  const TITLE: Record<Action, string> = {
    approve: "Approve this return?",
    reject: "Decline this return?",
    receive: "Mark the parcel as received?",
    refund: "Refund this return",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/returns", label: "Returns" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Return for {r.order.number} <ReturnBadge status={r.status} />
          </span>
        }
        description={`Requested ${formatDateTime(r.createdAt)} · ${RETURN_REASON_LABEL[r.reason] ?? r.reason}`}
        actions={
          <>
            {r.status === "REQUESTED" && <Button onClick={() => open("approve")}>Approve</Button>}
            {(r.status === "REQUESTED" || r.status === "APPROVED") && (
              <>
                <Button
                  variant={r.status === "APPROVED" ? "primary" : "outline"}
                  onClick={() => open("receive")}
                >
                  Parcel received
                </Button>
                <Button variant="outline" onClick={() => open("reject")}>
                  Decline
                </Button>
              </>
            )}
            {r.status === "RECEIVED" && isManager && (
              <Button onClick={() => open("refund")}>Refund</Button>
            )}
          </>
        }
      />
      {r.status === "RECEIVED" && !isManager && (
        <p className="bg-surface rounded-lg px-4 py-3 text-sm">
          A manager needs to issue the refund.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Items being returned">
            <ul className="divide-line divide-y">
              {r.items.map((i) => (
                <li key={i.orderItemId} className="flex gap-3 py-3 first:pt-0">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- product photos from any host
                    <img
                      src={i.imageUrl}
                      alt=""
                      className="bg-surface size-12 rounded-md object-cover"
                    />
                  ) : (
                    <span className="bg-surface size-12 rounded-md" />
                  )}
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{i.title}</p>
                    <p className="text-muted">
                      {i.color} / {i.size} · {i.sku}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">
                    {i.quantity} × {formatMoney(i.unitPrice)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="border-line border-t pt-3 text-right text-sm font-semibold">
              Items value {formatMoney(r.itemsValue)}
            </p>
          </Section>
          <Section title="From the customer">
            <DetailList
              items={[
                ["Reason", RETURN_REASON_LABEL[r.reason] ?? r.reason],
                [
                  "Details",
                  r.details ? <span className="whitespace-pre-line">{r.details}</span> : "—",
                ],
              ]}
            />
          </Section>
          {(r.adminNote || r.receivedAt || r.refundedAt) && (
            <Section title="Handling">
              <DetailList
                items={[
                  ...(r.adminNote ? [["Note", r.adminNote] as [string, string]] : []),
                  ...(r.receivedAt
                    ? [
                        [
                          "Received",
                          `${formatDateTime(r.receivedAt)}${r.restocked ? " · restocked" : " · not restocked"}`,
                        ] as [string, string],
                      ]
                    : []),
                  ...(r.refundedAt
                    ? [
                        [
                          "Refunded",
                          `${formatMoney(r.refundAmount ?? 0)} · ${formatDateTime(r.refundedAt)}`,
                        ] as [string, string],
                      ]
                    : []),
                ]}
              />
            </Section>
          )}
        </div>
        <div className="space-y-6">
          <Section title="Order">
            <DetailList
              items={[
                [
                  "Order",
                  <Link key="o" href={`/orders/${r.order.number}`} className="underline">
                    {r.order.number}
                  </Link>,
                ],
                ["Status", <OrderStatusBadge key="s" status={r.order.status} />],
                ["Customer", r.order.customerName],
                ["Email", r.order.email],
                ["Phone", r.order.phone],
                ["Delivered", formatDateTime(r.order.deliveredAt)],
                ["Payment", r.order.paymentMethod === "COD" ? "Cash on Delivery" : "Card"],
                ["Still refundable", formatMoney(r.order.refundable)],
              ]}
            />
          </Section>
        </div>
      </div>

      <Dialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog ? TITLE[dialog] : ""}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)} disabled={act.isPending}>
              Cancel
            </Button>
            <Button
              variant={dialog === "reject" ? "danger" : "primary"}
              onClick={submit}
              loading={act.isPending}
            >
              {dialog === "approve"
                ? "Approve"
                : dialog === "reject"
                  ? "Decline"
                  : dialog === "receive"
                    ? "Mark received"
                    : "Refund"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          {error && (
            <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {dialog === "approve" && (
            <p>
              The customer is emailed the store address (from Store settings) and asked to send the
              items back.
            </p>
          )}
          {dialog === "reject" && (
            <p>The order goes back to Delivered and the customer is emailed your reason.</p>
          )}
          {dialog === "receive" && (
            <Checkbox
              label="Put the items back in stock"
              hint="Untick if they're damaged or can't be sold again."
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
            />
          )}
          {dialog === "refund" && (
            <>
              <p className="text-muted">
                {r.order.paymentMethod === "COD"
                  ? "Cash on Delivery: this records a refund you pay back yourself."
                  : "Refunded to the customer's card through the payment provider."}{" "}
                Delivery fees aren&apos;t included by default.
              </p>
              <Field
                label="Amount (Rs)"
                htmlFor="return-refund"
                hint={`Up to ${formatMoney(r.order.refundable)}`}
              >
                <Input
                  id="return-refund"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            </>
          )}
          <Field
            label={dialog === "reject" ? "Reason (sent to the customer)" : "Note (optional)"}
            htmlFor="return-note"
            hint={
              dialog === "approve" ? "Included in the email, e.g. which courier to use." : undefined
            }
          >
            <Textarea
              id="return-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-16"
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
