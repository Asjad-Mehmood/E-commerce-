"use client";

import type { ApiResponse, AuthUser } from "@hoodie/types";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { meKey } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";
import { FormMessage } from "./auth-card";

export function VerifyEmail() {
  const token = useSearchParams().get("token");
  const qc = useQueryClient();
  const [state, setState] = useState<"verifying" | "done" | "error">(token ? "verifying" : "error");
  const [message, setMessage] = useState("This verification link is incomplete.");
  const started = useRef(false);

  useEffect(() => {
    // Guard against React strict mode running the effect twice (the token is single-use).
    if (!token || started.current) return;
    started.current = true;
    api<ApiResponse<AuthUser>>("/auth/verify-email", { method: "POST", body: { token } })
      .then(({ data }) => {
        setState("done");
        if (qc.getQueryData(meKey)) qc.setQueryData(meKey, data);
      })
      .catch((err) => {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "Something went wrong.");
      });
  }, [token, qc]);

  if (state === "verifying") return <p role="status">Verifying your email…</p>;
  if (state === "done") {
    return (
      <div className="space-y-4">
        <FormMessage tone="success">Your email is verified. Thank you!</FormMessage>
        <Link
          href="/shop"
          className="bg-ink inline-flex h-11 items-center rounded-lg px-6 text-sm font-semibold text-white"
        >
          Continue shopping
        </Link>
      </div>
    );
  }
  return (
    <FormMessage>
      {message} You can request a new link from{" "}
      <Link href="/account" className="underline">
        your account
      </Link>
      .
    </FormMessage>
  );
}
