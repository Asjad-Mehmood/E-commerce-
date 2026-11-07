import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/**
 * On Vercel the browser calls the API through this site (middleware.ts proxies
 * /api/v1), so the public API URL defaults to the relative "/api/v1" there.
 */
const onVercel = !!process.env.VERCEL;
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? (onVercel ? "/api/v1" : "http://localhost:4000/api/v1"),
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ??
      (productionUrl ? `https://${productionUrl}` : "http://localhost:3000"),
  },
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@hoodie/ui", "@hoodie/types", "@hoodie/validation"],
  // Image hosts resize pictures themselves (see lib/image-loader.ts), so this
  // works on any host without an image-optimisation quota.
  images: { loader: "custom", loaderFile: "./lib/image-loader.ts" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
