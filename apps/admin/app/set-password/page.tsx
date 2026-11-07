import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, SetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Set your password" };

export default function SetPasswordPage() {
  return (
    <AuthCard title="Set your password">
      <Suspense>
        <SetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
