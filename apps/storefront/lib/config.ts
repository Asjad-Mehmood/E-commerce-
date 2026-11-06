/** Public runtime config. Values come from NEXT_PUBLIC_* env vars with dev defaults. */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Hoodie Store",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  description:
    "Premium heavyweight hoodies: pullovers, zip-ups and oversized fits, delivered across Pakistan.",
};

export const mainNav = [
  { label: "Shop all", href: "/shop" },
  { label: "New arrivals", href: "/collections/new-arrivals" },
  { label: "Pullover", href: "/collections/pullover" },
  { label: "Zip-up", href: "/collections/zip-up" },
  { label: "Oversized", href: "/collections/oversized" },
];

export const footerNav = {
  Shop: [
    { label: "All hoodies", href: "/shop" },
    { label: "New arrivals", href: "/collections/new-arrivals" },
    { label: "Best sellers", href: "/collections/best-sellers" },
    { label: "Size guide", href: "/size-guide" },
  ],
  Help: [
    { label: "Track your order", href: "/track-order" },
    { label: "Shipping", href: "/policies/shipping" },
    { label: "Returns & exchanges", href: "/policies/returns" },
    { label: "FAQ", href: "/faq" },
  ],
  Company: [
    { label: "About us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy policy", href: "/policies/privacy" },
    { label: "Terms of service", href: "/policies/terms" },
  ],
};
