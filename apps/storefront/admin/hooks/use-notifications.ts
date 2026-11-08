"use client";

import type { AdminNotificationsDTO, ApiResponse } from "@hoodie/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/admin/lib/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/admin/lib/api";
import { formatMoney } from "@/admin/lib/format";

export const notificationsKey = ["admin", "notifications"] as const;

/** Polls the top-bar counts every 30 seconds and announces new orders. */
export function useNotifications() {
  const router = useRouter();
  const query = useQuery({
    queryKey: notificationsKey,
    queryFn: async () =>
      (await api<ApiResponse<AdminNotificationsDTO>>("/admin/notifications")).data,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const lastSeen = useRef<string | null | undefined>(undefined);
  const latest = query.data?.latestOrder;
  useEffect(() => {
    if (!query.data) return;
    const number = latest?.number ?? null;
    // The first load only sets the baseline.
    if (lastSeen.current !== undefined && number && number !== lastSeen.current && latest) {
      toast.success(`New order ${number}`, {
        description: formatMoney(latest.grandTotal),
        action: { label: "View", onClick: () => router.push(`/orders/${number}`) },
      });
    }
    lastSeen.current = number;
  }, [query.data, latest, router]);

  return query;
}
