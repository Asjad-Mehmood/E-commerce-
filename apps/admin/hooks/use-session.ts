"use client";

import type { ApiResponse, AuthUser, Role } from "@hoodie/types";
import { hasRole, isAdminRole } from "@hoodie/types";
import type { LoginInput } from "@hoodie/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

export const sessionKey = ["session"] as const;

/** The signed-in user, or null when signed out. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return (await api<ApiResponse<AuthUser | null>>("/auth/session")).data;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** The signed-in staff member (only call inside the admin shell, which guarantees one). */
export function useStaff(): AuthUser {
  const { data } = useSession();
  if (!data) throw new Error("useStaff() used outside the signed-in admin shell");
  return data;
}

/** True when the signed-in staff member has at least `minRole`. */
export function useCan(minRole: Role): boolean {
  const { data } = useSession();
  return !!data && hasRole(data.role, minRole);
}

export class NotStaffError extends Error {
  constructor() {
    super("This account does not have access to the admin panel.");
  }
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LoginInput) => {
      const { data } = await api<ApiResponse<{ user: AuthUser }>>("/auth/login", {
        method: "POST",
        body,
      });
      if (!isAdminRole(data.user.role)) {
        // A customer account: do not leave it signed in here.
        await api("/auth/logout", { method: "POST" }).catch(() => undefined);
        throw new NotStaffError();
      }
      return data.user;
    },
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(sessionKey, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(sessionKey, null);
    },
  });
}
