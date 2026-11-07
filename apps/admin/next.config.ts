import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  // The admin panel must never be indexed by search engines.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

/**
 * On Vercel the browser calls the API through this site (middleware.ts proxies
 * /api/v1), so the public API URL defaults to the relative "/api/v1" there.
 */
const onVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? (onVercel ? "/api/v1" : "http://localhost:4000/api/v1"),
  },
  transpilePackages: ["@hoodie/ui", "@hoodie/types", "@hoodie/validation"],
  // Staff see few images: load them as they are, from any host.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
