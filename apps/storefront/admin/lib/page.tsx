import type { Metadata } from "next";
import { Suspense, type ComponentType } from "react";

/** A page that renders one client screen (wrapped in Suspense for useSearchParams). */
export function screen(title: string, Screen: ComponentType) {
  const metadata: Metadata = { title };
  function Page() {
    return (
      <Suspense>
        <Screen />
      </Suspense>
    );
  }
  return { metadata, Page };
}
