import NextLink from "next/link";
import type { ComponentProps } from "react";
import { adminHref } from "./paths";

/** next/link for admin pages: "/orders" links to "/admin/orders". */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink href={typeof href === "string" ? adminHref(href) : href} {...props} />;
}
