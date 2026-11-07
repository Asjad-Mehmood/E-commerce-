"use client";

import type { NewsletterSubscriberDTO, PaginatedResponse } from "@hoodie/types";
import { Button } from "@hoodie/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FilterTabs, SearchBox } from "@/admin/components/ui/filters";
import { ErrorState, PageHeader } from "@/admin/components/ui/page";
import {
  LoadingRows,
  Pagination,
  Table,
  TableMessage,
  Td,
  Th,
  Tr,
} from "@/admin/components/ui/table";
import { useUrlState } from "@/admin/hooks/use-url-state";
import { api, downloadFile, errorMessage } from "@/admin/lib/api";
import { formatDate } from "@/admin/lib/format";

export function Newsletter() {
  const { values, set, query } = useUrlState<"status" | "q">();
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ["admin", "newsletter", query],
    queryFn: () =>
      api<PaginatedResponse<NewsletterSubscriberDTO> & { activeCount: number }>(
        `/admin/newsletter?${query}`,
      ),
    placeholderData: keepPreviousData,
  });
  const status = values.status ?? "active";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Newsletter"
        description={
          list.data
            ? `${list.data.activeCount.toLocaleString()} active subscriber${list.data.activeCount === 1 ? "" : "s"}. Export them to your email tool (e.g. Mailchimp) to send a campaign; every email must include an unsubscribe link.`
            : "People who signed up in the storefront footer."
        }
        actions={
          <Button
            variant="outline"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadFile(`/admin/newsletter?status=${status}&format=csv`);
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Export CSV
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Subscriber status"
          value={status}
          onChange={(s) => set({ status: s === "active" ? "" : s })}
          options={[
            { value: "active", label: "Subscribed" },
            { value: "unsubscribed", label: "Unsubscribed" },
          ]}
        />
        <SearchBox
          value={values.q ?? ""}
          onSearch={(q) => set({ q })}
          placeholder="Email"
          label="Search subscribers"
          className="w-full sm:w-64"
        />
      </div>
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      <Table className={list.isPlaceholderData ? "opacity-60" : undefined}>
        <thead>
          <tr>
            <Th>Email</Th>
            <Th>Subscribed</Th>
            {status === "unsubscribed" && <Th>Unsubscribed</Th>}
          </tr>
        </thead>
        <tbody>
          {list.isPending ? (
            <LoadingRows cols={2} />
          ) : list.data?.data.length === 0 ? (
            <TableMessage cols={3}>No subscribers here.</TableMessage>
          ) : (
            list.data?.data.map((s) => (
              <Tr key={s.id}>
                <Td>{s.email}</Td>
                <Td className="text-muted">{formatDate(s.createdAt)}</Td>
                {status === "unsubscribed" && (
                  <Td className="text-muted">{formatDate(s.unsubscribedAt)}</Td>
                )}
              </Tr>
            ))
          )}
        </tbody>
      </Table>
      <Pagination meta={list.data?.meta} onPage={(page) => set({ page })} label="subscribers" />
    </div>
  );
}
