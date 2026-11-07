"use client";

import type { ApiResponse, ContactMessageDTO, PaginatedResponse } from "@hoodie/types";
import { Button, cn } from "@hoodie/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/admin/components/ui/controls";
import { FilterTabs, SearchBox } from "@/admin/components/ui/filters";
import { EmptyState, ErrorState, PageHeader } from "@/admin/components/ui/page";
import { MessageStatusBadge } from "@/admin/components/ui/status";
import { Pagination } from "@/admin/components/ui/table";
import { notificationsKey } from "@/admin/hooks/use-notifications";
import { useUrlState } from "@/admin/hooks/use-url-state";
import { api, errorMessage } from "@/admin/lib/api";
import { formatDateTime, timeAgo } from "@/admin/lib/format";

function MessageItem({ m }: { m: ContactMessageDTO }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "messages"] });
    void qc.invalidateQueries({ queryKey: notificationsKey });
  };
  const setStatus = useMutation({
    mutationFn: (status: ContactMessageDTO["status"]) =>
      api(`/admin/messages/${m.id}`, { method: "PATCH", body: { status } }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const send = useMutation({
    mutationFn: () =>
      api<ApiResponse<ContactMessageDTO>>(`/admin/messages/${m.id}/reply`, {
        method: "POST",
        body: { body: reply },
      }),
    onSuccess: () => {
      toast.success(`Reply sent to ${m.email}`);
      setReply("");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && m.status === "NEW") setStatus.mutate("READ");
  };

  return (
    <li
      className={cn(
        "border-line bg-canvas rounded-(--radius-card) border",
        m.status === "NEW" && "border-l-brand-600 border-l-4",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left"
      >
        <span className={cn("min-w-0 flex-1", m.status === "NEW" && "font-semibold")}>
          {m.subject || "(no subject)"}
          <span className="text-muted block truncate text-sm font-normal">
            {m.name} · {m.email}
          </span>
        </span>
        <MessageStatusBadge status={m.status} />
        <span className="text-muted text-xs" title={formatDateTime(m.createdAt)}>
          {timeAgo(m.createdAt)}
        </span>
      </button>
      {open && (
        <div className="border-line space-y-4 border-t p-4">
          <p className="whitespace-pre-line text-sm leading-relaxed">{m.message}</p>
          <div className="space-y-2">
            <label htmlFor={`reply-${m.id}`} className="text-sm font-medium">
              Reply by email
            </label>
            <Textarea
              id={`reply-${m.id}`}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={`Hi ${m.name.split(" ")[0]},`}
              maxLength={5000}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={reply.trim().length < 2}
                loading={send.isPending}
                onClick={() => send.mutate()}
              >
                Send reply
              </Button>
              {m.status !== "ARCHIVED" ? (
                <Button size="sm" variant="outline" onClick={() => setStatus.mutate("ARCHIVED")}>
                  Archive
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setStatus.mutate("READ")}>
                  Move to inbox
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export function Messages() {
  const { values, set, query } = useUrlState<"q" | "status">();
  const messages = useQuery({
    queryKey: ["admin", "messages", query],
    queryFn: () => api<PaginatedResponse<ContactMessageDTO>>(`/admin/messages?${query}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Messages" description="Contact form messages from the storefront." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Message status"
          value={values.status ?? ""}
          onChange={(status) => set({ status })}
          options={[
            { value: "", label: "Inbox" },
            { value: "NEW", label: "New" },
            { value: "REPLIED", label: "Replied" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
        />
        <SearchBox value={values.q ?? ""} onSearch={(q) => set({ q })} label="Search messages" />
      </div>
      {messages.isError && <ErrorState message={errorMessage(messages.error)} />}
      {messages.data?.data.length === 0 ? (
        <EmptyState title="No messages here">
          Messages sent from the storefront&apos;s contact page appear here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {messages.data?.data.map((m) => (
            <MessageItem key={m.id} m={m} />
          ))}
        </ul>
      )}
      <Pagination meta={messages.data?.meta} onPage={(page) => set({ page })} label="messages" />
    </div>
  );
}
