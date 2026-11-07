"use client";

import type { AdminReviewDTO, ApiResponse, PaginatedResponse } from "@hoodie/types";
import { Badge, Button, cn } from "@hoodie/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/admin/components/ui/confirm";
import { Select, Textarea } from "@/admin/components/ui/controls";
import { FilterTabs, SearchBox } from "@/admin/components/ui/filters";
import { EmptyState, ErrorState, PageHeader } from "@/admin/components/ui/page";
import { Pagination } from "@/admin/components/ui/table";
import { notificationsKey } from "@/admin/hooks/use-notifications";
import { useCan } from "@/admin/hooks/use-session";
import { useUrlState } from "@/admin/hooks/use-url-state";
import { api, errorMessage } from "@/admin/lib/api";
import { adminConfig } from "@/admin/lib/config";
import { formatDateTime } from "@/admin/lib/format";

function Rating({ value }: { value: number }) {
  return (
    <span className="font-semibold tracking-wider" aria-label={`${value} out of 5 stars`}>
      <span aria-hidden>{"★".repeat(value)}</span>
      <span aria-hidden className="text-line">
        {"★".repeat(5 - value)}
      </span>
    </span>
  );
}

function ReviewCard({ r }: { r: AdminReviewDTO }) {
  const qc = useQueryClient();
  const canDelete = useCan("MANAGER");
  const [reply, setReply] = useState(r.adminReply ?? "");
  const [replying, setReplying] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
    void qc.invalidateQueries({ queryKey: notificationsKey });
  };
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<ApiResponse<AdminReviewDTO>>(`/admin/reviews/${r.id}`, { method: "PATCH", body }),
    onSuccess: (_res, body) => {
      toast.success(
        "isApproved" in body
          ? body.isApproved
            ? "Review published"
            : "Review hidden"
          : "Reply saved",
      );
      setReplying(false);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/reviews/${r.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Review deleted");
      setConfirm(false);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <li
      className={cn(
        "border-line bg-canvas rounded-(--radius-card) space-y-3 border p-4",
        !r.isApproved && "border-l-warning border-l-4",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {r.product.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- thumbnails from any host
            <img
              src={r.product.image}
              alt=""
              className="bg-surface size-10 rounded-md object-cover"
            />
          ) : (
            <span className="bg-surface size-10 rounded-md" />
          )}
          <div className="min-w-0 text-sm">
            <a
              href={`${adminConfig.storefrontUrl}/products/${r.product.slug}#reviews`}
              target="_blank"
              rel="noreferrer"
              className="block truncate font-medium hover:underline"
            >
              {r.product.title}
            </a>
            <span className="text-muted">
              {r.user.name} · {r.user.email} · {formatDateTime(r.createdAt)}
            </span>
          </div>
        </div>
        {r.isApproved ? (
          <Badge tone="success">Published</Badge>
        ) : (
          <Badge tone="warning">Waiting</Badge>
        )}
      </div>
      <div className="text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <Rating value={r.rating} />
          {r.title && <span className="font-semibold">{r.title}</span>}
        </p>
        <p className="mt-1 whitespace-pre-line leading-relaxed">{r.body}</p>
      </div>
      {r.adminReply && !replying && (
        <div className="bg-surface rounded-lg p-3 text-sm">
          <p className="text-muted text-xs font-semibold uppercase">Public reply</p>
          <p className="mt-1 whitespace-pre-line">{r.adminReply}</p>
        </div>
      )}
      {replying && (
        <div className="space-y-2">
          <Textarea
            aria-label="Public reply"
            value={reply}
            maxLength={1000}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Shown under the review on the store"
            className="min-h-16"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={update.isPending}
              onClick={() => update.mutate({ adminReply: reply })}
            >
              Save reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {r.isApproved ? (
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending}
            onClick={() => update.mutate({ isApproved: false })}
          >
            Hide
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate({ isApproved: true })}
          >
            Publish
          </Button>
        )}
        {!replying && (
          <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>
            {r.adminReply ? "Edit reply" : "Reply"}
          </Button>
        )}
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="text-danger ml-auto"
            onClick={() => setConfirm(true)}
          >
            Delete
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this review?"
        tone="danger"
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      >
        Use this for spam or abuse. To keep it off the store but keep a record, hide it instead.
      </ConfirmDialog>
    </li>
  );
}

export function Reviews() {
  const { values, set, query } = useUrlState<"status" | "q" | "rating">();
  const list = useQuery({
    queryKey: ["admin", "reviews", query],
    queryFn: () => api<PaginatedResponse<AdminReviewDTO>>(`/admin/reviews?limit=20&${query}`),
    placeholderData: keepPreviousData,
  });
  const status = values.status ?? "pending";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reviews"
        description="Only customers who received the product can review it. New reviews wait here until published (unless auto-publish is on in Store settings)."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Review status"
          value={status}
          onChange={(s) => set({ status: s === "pending" ? "" : s })}
          options={[
            { value: "pending", label: "Waiting" },
            { value: "approved", label: "Published" },
            { value: "all", label: "All" },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <SearchBox
            value={values.q ?? ""}
            onSearch={(q) => set({ q })}
            placeholder="Product, text or email"
            label="Search reviews"
            className="w-full sm:w-64"
          />
          <Select
            aria-label="Rating"
            className="w-auto"
            value={values.rating ?? ""}
            onChange={(e) => set({ rating: e.target.value })}
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? "" : "s"}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {list.isError && <ErrorState message={errorMessage(list.error)} />}
      {list.data?.data.length === 0 ? (
        <EmptyState title={status === "pending" ? "Nothing to moderate" : "No reviews found"}>
          {status === "pending" ? "New reviews from customers will appear here." : undefined}
        </EmptyState>
      ) : (
        <ul className={cn("space-y-3", list.isPlaceholderData && "opacity-60")}>
          {list.data?.data.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </ul>
      )}
      <Pagination meta={list.data?.meta} onPage={(page) => set({ page })} label="reviews" />
    </div>
  );
}
