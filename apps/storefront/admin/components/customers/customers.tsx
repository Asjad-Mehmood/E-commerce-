"use client";

import type {
  AdminCustomerDTO,
  AdminCustomerListItemDTO,
  ApiResponse,
  PaginatedResponse,
} from "@hoodie/types";
import { Badge, Button, Skeleton } from "@hoodie/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "@/admin/lib/link";
import { useRouter } from "@/admin/lib/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/admin/components/ui/confirm";
import { Select, Textarea } from "@/admin/components/ui/controls";
import { FilterTabs, SearchBox } from "@/admin/components/ui/filters";
import { DetailList, ErrorState, PageHeader, Section } from "@/admin/components/ui/page";
import { OrderStatusBadge } from "@/admin/components/ui/status";
import {
  LoadingRows,
  Pagination,
  Table,
  TableMessage,
  Td,
  Th,
  Tr,
} from "@/admin/components/ui/table";
import { useCan } from "@/admin/hooks/use-session";
import { useUrlState } from "@/admin/hooks/use-url-state";
import { api, ApiError, errorMessage } from "@/admin/lib/api";
import { formatDate, formatDateTime, formatMoney } from "@/admin/lib/format";

export function CustomersList() {
  const router = useRouter();
  const { values, set, query } = useUrlState<"q" | "status" | "sort">();
  const customers = useQuery({
    queryKey: ["admin", "customers", query],
    queryFn: () =>
      api<PaginatedResponse<AdminCustomerListItemDTO>>(`/admin/customers?limit=25&${query}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Registered accounts. Guest orders appear under Orders. Lifetime value is net of refunds."
      />
      <FilterTabs
        label="Account status"
        value={values.status ?? ""}
        onChange={(status) => set({ status })}
        options={[
          { value: "", label: "All" },
          { value: "active", label: "Active" },
          { value: "blocked", label: "Blocked" },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={values.q ?? ""}
          onSearch={(q) => set({ q })}
          placeholder="Name, email or phone"
          label="Search customers"
          className="w-full sm:w-72"
        />
        <Select
          aria-label="Sort customers"
          className="w-auto"
          value={values.sort ?? "newest"}
          onChange={(e) => set({ sort: e.target.value === "newest" ? "" : e.target.value })}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="spent">Highest lifetime value</option>
          <option value="orders">Most orders</option>
          <option value="name">Name A–Z</option>
        </Select>
      </div>

      {customers.isError && <ErrorState message={errorMessage(customers.error)} />}
      <Table className={customers.isPlaceholderData ? "opacity-60" : undefined}>
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th>Phone</Th>
            <Th>Joined</Th>
            <Th className="text-right">Orders</Th>
            <Th className="text-right">Lifetime value</Th>
            <Th>Last order</Th>
          </tr>
        </thead>
        <tbody>
          {customers.isPending ? (
            <LoadingRows cols={6} />
          ) : customers.data?.data.length === 0 ? (
            <TableMessage cols={6}>No customers found.</TableMessage>
          ) : (
            customers.data?.data.map((c) => (
              <Tr
                key={c.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("a")) router.push(`/customers/${c.id}`);
                }}
              >
                <Td>
                  <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  {c.isBlocked && (
                    <Badge tone="danger" className="ml-2">
                      Blocked
                    </Badge>
                  )}
                  <span className="text-muted block">{c.email}</span>
                </Td>
                <Td className="text-muted">{c.phone ?? "—"}</Td>
                <Td className="text-muted">{formatDate(c.createdAt)}</Td>
                <Td className="text-right tabular-nums">{c.orderCount}</Td>
                <Td className="text-right tabular-nums">{formatMoney(c.totalSpent)}</Td>
                <Td className="text-muted">{formatDate(c.lastOrderAt)}</Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
      <Pagination meta={customers.data?.meta} onPage={(page) => set({ page })} label="customers" />
    </div>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const canBlock = useCan("MANAGER");
  const [confirm, setConfirm] = useState(false);
  const key = ["admin", "customer", id];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await api<ApiResponse<AdminCustomerDTO>>(`/admin/customers/${id}`)).data,
  });
  const [note, setNote] = useState("");
  useEffect(() => setNote(query.data?.adminNote ?? ""), [query.data?.adminNote]);

  const update = useMutation({
    mutationFn: async ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      (
        await api<ApiResponse<AdminCustomerDTO>>(`/admin/customers/${id}${path}`, {
          method: "PATCH",
          body,
        })
      ).data,
    onSuccess: (c) => {
      qc.setQueryData(key, c);
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Customer" back={{ href: "/customers", label: "Customers" }} />
        <ErrorState
          message={
            query.error instanceof ApiError && query.error.status === 404
              ? "This customer doesn't exist."
              : errorMessage(query.error)
          }
        />
      </div>
    );
  }
  const c = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/customers", label: "Customers" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.name}
            {c.isBlocked && <Badge tone="danger">Blocked</Badge>}
          </span>
        }
        description={`Customer since ${formatDate(c.createdAt)}`}
        actions={
          canBlock && (
            <Button variant={c.isBlocked ? "outline" : "danger"} onClick={() => setConfirm(true)}>
              {c.isBlocked ? "Unblock" : "Block customer"}
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Orders", c.orderCount.toLocaleString()],
          ["Lifetime value", formatMoney(c.totalSpent)],
          ["Average order", formatMoney(c.averageOrderValue)],
        ].map(([label, value]) => (
          <div key={label} className="border-line bg-canvas rounded-(--radius-card) border p-4">
            <p className="text-muted text-sm">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Orders">
            {c.orders.length === 0 ? (
              <p className="text-muted text-sm">No orders yet.</p>
            ) : (
              <ul className="divide-line divide-y text-sm">
                {c.orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.number}`}
                      className="hover:bg-surface -mx-2 flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5"
                    >
                      <span className="w-24 font-medium">{o.number}</span>
                      <span className="text-muted flex-1">{formatDateTime(o.placedAt)}</span>
                      <OrderStatusBadge status={o.status} />
                      <span className="w-24 text-right tabular-nums">
                        {formatMoney(o.grandTotal)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Addresses">
            {c.addresses.length === 0 ? (
              <p className="text-muted text-sm">No saved addresses.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {c.addresses.map((a) => (
                  <li key={a.id} className="border-line rounded-lg border p-3 text-sm">
                    {a.isDefault && <Badge className="mb-2">Default</Badge>}
                    <p className="font-medium">{a.fullName}</p>
                    <p>
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                    </p>
                    <p>
                      {a.city} {a.postalCode}
                    </p>
                    <p className="text-muted">{a.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Contact">
            <DetailList
              items={[
                [
                  "Email",
                  <a key="e" href={`mailto:${c.email}`} className="underline">
                    {c.email}
                  </a>,
                ],
                ["Email verified", c.emailVerified ? "Yes" : "No"],
                ["Phone", c.phone ?? "—"],
                ["Last sign-in", formatDateTime(c.lastLoginAt)],
                ["First order", formatDate(c.firstOrderAt)],
                ["Last order", formatDate(c.lastOrderAt)],
              ]}
            />
          </Section>
          <Section title="Staff note" description="Private. The customer never sees this.">
            <Textarea
              aria-label="Staff note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={note.trim() === (c.adminNote ?? "")}
              loading={update.isPending && update.variables?.path === ""}
              onClick={() =>
                update.mutate(
                  { path: "", body: { adminNote: note } },
                  { onSuccess: () => toast.success("Note saved") },
                )
              }
            >
              Save note
            </Button>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={c.isBlocked ? `Unblock ${c.name}?` : `Block ${c.name}?`}
        tone={c.isBlocked ? "primary" : "danger"}
        confirmLabel={c.isBlocked ? "Unblock" : "Block"}
        loading={update.isPending}
        onConfirm={() =>
          update.mutate(
            { path: "/block", body: { isBlocked: !c.isBlocked } },
            {
              onSuccess: (u) => {
                toast.success(u.isBlocked ? "Customer blocked" : "Customer unblocked");
                setConfirm(false);
              },
            },
          )
        }
      >
        {c.isBlocked
          ? "They will be able to sign in and place orders again."
          : "They are signed out everywhere and can't sign in or check out with this account. Their past orders are kept."}
      </ConfirmDialog>
    </div>
  );
}
