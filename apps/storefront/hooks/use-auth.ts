"use client";

import type { ApiResponse, AuthProvidersDTO, AuthUser } from "@hoodie/types";
import type { LoginInput, RegisterInput } from "@hoodie/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export const meKey = ["me"] as const;

/**
 * Google sign-in and whether the store sends email at all (email stays off
 * until it's set up in the admin), so the UI doesn't promise emails it can't send.
 */
export function useAuthProviders() {
  return useQuery({
    queryKey: ["auth-providers"],
    queryFn: async () => (await api<ApiResponse<AuthProvidersDTO>>("/auth/providers")).data,
    staleTime: 5 * 60_000,
  });
}

/** True only once we know email is set up. */
export const useEmailEnabled = () => useAuthProviders().data?.email === true;

/** The signed-in user, or null for guests. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return (await api<ApiResponse<AuthUser | null>>("/auth/session")).data;
      } catch (err) {
        // Refresh failed (session revoked or expired): treat as signed out.
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

type Session = ApiResponse<{ user: AuthUser }>;

function useSessionMutation<T>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: T) =>
      api<Session>(path, { method: "POST", body: body as Record<string, unknown> }),
    onSuccess: ({ data }) => {
      qc.setQueryData(meKey, data.user);
      // The API merged any guest cart into the account.
      void qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}

export const useLogin = () => useSessionMutation<LoginInput>("/auth/login");
export const useRegister = () => useSessionMutation<RegisterInput>("/auth/register");

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(meKey, null);
      qc.removeQueries({ queryKey: ["addresses"] });
      void qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}
