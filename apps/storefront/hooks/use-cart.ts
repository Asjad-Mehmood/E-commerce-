"use client";

import type { ApiResponse, CartDTO } from "@hoodie/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "./use-auth";

export const cartKey = ["cart"] as const;

/**
 * The current cart. Waits until the session is known, so a signed-in shopper
 * whose token needs refreshing never briefly sees an empty guest cart.
 */
export function useCart() {
  const me = useMe();
  return useQuery({
    queryKey: cartKey,
    queryFn: async () => (await api<ApiResponse<CartDTO>>("/cart")).data,
    enabled: me.isFetched,
  });
}

function useCartMutation<V>(request: (vars: V) => Promise<ApiResponse<CartDTO>>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: ({ data }) => qc.setQueryData(cartKey, data),
  });
}

export const useAddToCart = () =>
  useCartMutation((body: { variantId: string; quantity: number }) =>
    api<ApiResponse<CartDTO>>("/cart/items", { method: "POST", body }),
  );

export const useUpdateCartItem = () =>
  useCartMutation(({ id, quantity }: { id: string; quantity: number }) =>
    api<ApiResponse<CartDTO>>(`/cart/items/${id}`, { method: "PATCH", body: { quantity } }),
  );

export const useRemoveCartItem = () =>
  useCartMutation((id: string) =>
    api<ApiResponse<CartDTO>>(`/cart/items/${id}`, { method: "DELETE" }),
  );

export const useApplyCoupon = () =>
  useCartMutation((code: string) =>
    api<ApiResponse<CartDTO>>("/cart/coupon", { method: "POST", body: { code } }),
  );

export const useRemoveCoupon = () =>
  useCartMutation(() => api<ApiResponse<CartDTO>>("/cart/coupon", { method: "DELETE" }));
