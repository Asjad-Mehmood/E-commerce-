"use client";

import type { ApiResponse, AuditLogEntryDTO, PaginatedResponse } from "@hoodie/types";
import { Input } from "@hoodie/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Select } from "@/components/ui/controls";
import { SearchBox } from "@/components/ui/filters";
import { ErrorState, PageHeader } from "@/components/ui/page";
import { LoadingRows, Pagination, Table, TableMessage, Td, Th, Tr } from "@/components/ui/table";
import { useUrlState } from "@/hooks/use-url-state";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/** Where a log entry's record can be opened in the admin, if anywhere. */
function recordLink(e: AuditLogEntryDTO): string | null {
  const diff = (e.diff ?? {}) as Record<string, unknown>;
  if (e.entity === "Order" && typeof diff.number === "string") return `/orders/${diff.number}`;
  if (e.entity === "Product" && !e.entityId.includes(",")) return `/products/${e.entityId}`;
  if (e.entity === "User" && e.action.startsWith("customer.")) return `/customers/${e.entityId}`;
  return null;
}

export function AuditLog() {
  const { values, set, query } = useUrlState<"q" | "entity" | "from" | "to">();
  const [open, setOpen] = useState<string | null>(null);
  const entities = useQuery({
    queryKey: ["admin", "audit", "entities"],
    queryFn: async () => (await api<ApiResponse<string[]>>("/admin/audit-log/entities")).data,
  });
  const log = useQuery({
    queryKey: ["admin", "audit", query],
    queryFn: () => api<PaginatedResponse<AuditLogEntryDTO>>(`/admin/audit-log?${query}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity log"
        description="Every change made in the admin panel: who, what and when."
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={values.q ?? ""}
          onSearch={(q) => set({ q })}
          placeholder="Action, e.g. refund"
          label="Search the log"
          className="w-full sm:w-60"
        />
        <Select
          aria-label="Record type"
          className="w-auto"
          value={values.entity ?? ""}
          onChange={(e) => set({ entity: e.target.value })}
        >
          <option value="">All records</option>
          {entities.data?.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label="From"
          className="w-auto"
          value={values.from ?? ""}
          onChange={(e) => set({ from: e.target.value })}
        />
        <Input
          type="date"
          aria-label="To"
          className="w-auto"
          value={values.to ?? ""}
          onChange={(e) => set({ to: e.target.value })}
        />
      </div>
      {log.isError && <ErrorState message={errorMessage(log.error)} />}
      <Table className={log.isPlaceholderData ? "opacity-60" : undefined}>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>Action</Th>
            <Th>Record</Th>
            <Th>
              <span className="sr-only">Details</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {log.isPending ? (
            <LoadingRows cols={5} />
          ) : log.data?.data.length === 0 ? (
            <TableMessage cols={5}>Nothing logged for these filters.</TableMessage>
          ) : (
            log.data?.data.map((e) => {
              const href = recordLink(e);
              return (
                <Fragment key={e.id}>
                  <Tr>
                    <Td className="text-muted whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                    <Td>
                      {e.admin ? (
                        <>
                          <span className="font-medium">{e.admin.name}</span>
                          <span className="text-muted block text-xs">{e.admin.email}</span>
                        </>
                      ) : (
                        <span className="text-muted">Deleted user</span>
                      )}
                    </Td>
                    <Td className="font-mono text-xs">{e.action}</Td>
                    <Td className="text-sm">
                      {e.entity}{" "}
                      {href ? (
                        <Link href={href} className="text-muted font-mono text-xs underline">
                          {(e.diff as { number?: string } | null)?.number ??
                            e.entityId.slice(0, 10)}
                        </Link>
                      ) : (
                        <span className="text-muted font-mono text-xs">
                          {e.entityId.slice(0, 24)}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      {e.diff != null && (
                        <button
                          type="button"
                          className="text-sm underline"
                          aria-expanded={open === e.id}
                          onClick={() => setOpen(open === e.id ? null : e.id)}
                        >
                          {open === e.id ? "Hide" : "Details"}
                        </button>
                      )}
                    </Td>
                  </Tr>
                  {open === e.id && (
                    <tr>
                      <td colSpan={5} className="bg-surface border-line border-b px-4 py-3">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
                          {JSON.stringify(e.diff, null, 2)}
                        </pre>
                        {e.ip && <p className="text-muted mt-2 text-xs">IP address: {e.ip}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </Table>
      <Pagination meta={log.data?.meta} onPage={(page) => set({ page })} label="entries" />
    </div>
  );
}
