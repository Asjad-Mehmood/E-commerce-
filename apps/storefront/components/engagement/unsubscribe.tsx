"use client";

import { Button } from "@hoodie/ui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

const WHAT = {
  newsletter: "our newsletter",
  cart: "cart reminder emails",
} as const;

/**
 * Confirms before unsubscribing: some email scanners open every link, so the
 * change only happens when a person presses the button.
 */
export function Unsubscribe() {
  const params = useSearchParams();
  const type = params.get("type") as keyof typeof WHAT | null;
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const run = useMutation({
    mutationFn: () =>
      api("/email-preferences/unsubscribe", { method: "POST", body: { type, email, token } }),
  });

  if (!type || !(type in WHAT) || !email || !token) {
    return <p className="text-muted">This link is incomplete. Open it again from the email.</p>;
  }
  if (run.isSuccess) {
    return (
      <div role="status" className="space-y-3">
        <p className="font-medium">
          Done. {email} won&apos;t get {WHAT[type]} any more.
        </p>
        <p className="text-muted text-sm">
          You&apos;ll still get emails about your orders.{" "}
          <Link href="/" className="text-ink underline">
            Back to the store
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p>
        Stop sending {WHAT[type]} to <strong>{email}</strong>?
      </p>
      {run.isError && (
        <p role="alert" className="bg-danger/10 text-danger rounded-lg p-3 text-sm">
          {run.error instanceof ApiError
            ? run.error.message
            : "Something went wrong. Please try again."}
        </p>
      )}
      <Button onClick={() => run.mutate()} loading={run.isPending}>
        Unsubscribe
      </Button>
    </div>
  );
}
