import { Container } from "@hoodie/ui";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Container className="flex justify-center py-12 sm:py-20">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted mt-2">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="text-muted mt-8 text-center text-sm">{footer}</div>}
      </div>
    </Container>
  );
}

export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "bg-danger/10 text-danger rounded-lg p-3 text-sm"
          : "bg-success/10 text-success rounded-lg p-3 text-sm"
      }
    >
      {children}
    </div>
  );
}

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
