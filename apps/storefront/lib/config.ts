/** Public runtime config. Values come from env vars with development defaults. */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Urban Store",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** API URL used by the browser. */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  description:
    "Urban Store: everyday streetwear hoodies made in Pakistan. Pullovers, zip-ups and oversized fits, with Cash on Delivery nationwide.",
  currency: "PKR",
};

/** API URL used by server components (can be an internal address in production). */
export const serverApiUrl = process.env.API_URL ?? siteConfig.apiUrl;

export const footerNav = {
  Shop: [
    { label: "All hoodies", href: "/shop" },
    { label: "New arrivals", href: "/collections/new-arrivals" },
    { label: "Best sellers", href: "/collections/best-sellers" },
    { label: "Size guide", href: "/size-guide" },
  ],
  Help: [
    { label: "Track your order", href: "/track-order" },
    { label: "FAQ", href: "/faq" },
    { label: "Shipping", href: "/policies/shipping" },
    { label: "Returns & exchanges", href: "/policies/returns" },
    { label: "Contact us", href: "/contact" },
  ],
  Company: [
    { label: "About us", href: "/about" },
    { label: "Privacy policy", href: "/policies/privacy" },
    { label: "Terms of service", href: "/policies/terms" },
  ],
};
