import type { ReactNode } from "react";
import { AdminShell } from "@/components/shell/admin-shell";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
