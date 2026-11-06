"use client";

import type { AddressDTO, ApiResponse } from "@hoodie/types";
import type { AddressInput } from "@hoodie/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "./use-auth";

const key = ["addresses"] as const;

export function useAddresses() {
  const me = useMe();
  return useQuery({
    queryKey: key,
    queryFn: async () => (await api<ApiResponse<AddressDTO[]>>("/me/addresses")).data,
    enabled: !!me.data,
  });
}

export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: AddressInput & { id?: string }) =>
      api<ApiResponse<AddressDTO>>(id ? `/me/addresses/${id}` : "/me/addresses", {
        method: id ? "PUT" : "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/me/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
}
