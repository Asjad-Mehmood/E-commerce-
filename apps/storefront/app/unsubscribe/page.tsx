import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Unsubscribe } from "@/components/engagement/unsubscribe";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false } };

export default function UnsubscribePage() {
  return (
    <AuthCard title="Email preferences">
      <Suspense>
        <Unsubscribe />
      </Suspense>
    </AuthCard>
  );
}
