"use client";

import type { ApiResponse, ProductCardDTO } from "@hoodie/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "./use-auth";

export const wishlistIdsKey = ["wishlist", "ids"] as const;
export const wishlistKey = ["wishlist", "items"] as const;

/** IDs of saved products (empty for guests). */
export function useWishlistIds() {
  const me = useMe();
  return useQuery({
    queryKey: wishlistIdsKey,
    queryFn: async () => (await api<ApiResponse<string[]>>("/me/wishlist/ids")).data,
    enabled: !!me.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWishlist() {
  const me = useMe();
  return useQuery({
    queryKey: wishlistKey,
    queryFn: async () => (await api<ApiResponse<ProductCardDTO[]>>("/me/wishlist")).data,
    enabled: !!me.data,
  });
}

/** Saves or removes a product, updating the hearts immediately (rolled back on error). */
export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, saved }: { productId: string; saved: boolean }) =>
      api(`/me/wishlist/${productId}`, { method: saved ? "PUT" : "DELETE" }),
    onMutate: async ({ productId, saved }) => {
      await qc.cancelQueries({ queryKey: wishlistIdsKey });
      const previous = qc.getQueryData<string[]>(wishlistIdsKey);
      qc.setQueryData<string[]>(wishlistIdsKey, (ids = []) =>
        saved ? [...new Set([...ids, productId])] : ids.filter((id) => id !== productId),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(wishlistIdsKey, ctx?.previous),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: wishlistIdsKey });
      void qc.invalidateQueries({ queryKey: wishlistKey });
    },
  });
}
