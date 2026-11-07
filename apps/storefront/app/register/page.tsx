import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Faster checkout, order tracking and saved addresses."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-ink font-medium underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense>
        <GoogleButton />
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
