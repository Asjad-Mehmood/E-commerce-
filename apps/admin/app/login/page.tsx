import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard title="Sign in to the admin panel">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
