"use client";

import type { ApiResponse } from "@hoodie/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";

/**
 * List + create/update/delete for a simple admin collection (categories,
 * coupons, banners...). `path` is the API collection path, e.g. "/admin/coupons".
 */
export function useCrud<T extends { id: string }>(path: string, extraKeys: string[][] = []) {
  const qc = useQueryClient();
  const key = ["admin", "crud", path];
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: key });
    for (const k of extraKeys) void qc.invalidateQueries({ queryKey: k });
  };

  const list = useQuery({
    queryKey: key,
    queryFn: async () => (await api<ApiResponse<T[]>>(path)).data,
  });

  const save = useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      (
        await api<ApiResponse<T>>(id ? `${path}/${id}` : path, {
          method: id ? "PATCH" : "POST",
          body,
        })
      ).data,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`${path}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return { list, save, remove };
}
