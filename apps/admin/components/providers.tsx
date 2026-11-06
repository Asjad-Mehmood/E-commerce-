"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { sessionKey } from "@/hooks/use-session";
import { ApiError } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const qc: QueryClient = new QueryClient({
      queryCache: new QueryCache({
        // The session ended (expired and could not refresh, or the account was
        // blocked): drop it, and the shell sends the user to the login page.
        onError: (err, query) => {
          const ended =
            err instanceof ApiError &&
            (err.status === 401 || (err.status === 403 && err.code === "ACCOUNT_BLOCKED"));
          if (ended && query.queryKey[0] !== sessionKey[0]) qc.setQueryData(sessionKey, null);
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 15 * 1000,
          refetchOnWindowFocus: true,
          retry: (count, err) =>
            !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
        },
      },
    });
    return qc;
  });
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
