import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = dirname(fileURLToPath(import.meta.url));

// Locally the API's settings live in apps/api/.env (database, secrets…). This
// site serves the API too, so load them (already-set variables win). On
// Vercel they come from the project's environment variables instead.
const apiEnv = join(here, "../api/.env");
if (existsSync(apiEnv)) process.loadEnvFile(apiEnv);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

/**
 * One site: the shop (app/(shop)), the admin panel (app/admin) and the API
 * (pages/api/v1, from apps/api).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ??
      (productionUrl ? `https://${productionUrl}` : "http://localhost:3000"),
  },
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@hoodie/ui", "@hoodie/types", "@hoodie/validation"],
  // The API is loaded as built (apps/api/dist), with its own dependencies
  // (Prisma, argon2, pdfkit…), rather than bundled into the site. It is a
  // workspace package outside node_modules, which Next would otherwise bundle.
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [
        ({ request }: { request?: string }, callback: (err?: null, result?: string) => void) =>
          request?.startsWith("@hoodie/api") ? callback(null, `import ${request}`) : callback(),
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
      ];
    }
    return config;
  },
  // Trace files from the whole monorepo, so the API's dependencies (and the
  // Prisma engine) are deployed with the site.
  outputFileTracingRoot: join(here, "../.."),
  // Image hosts resize pictures themselves (see lib/image-loader.ts), so this
  // works on any host without an image-optimisation quota.
  images: { loader: "custom", loaderFile: "./lib/image-loader.ts" },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The admin panel must never be indexed or framed.
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      { source: "/admin", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
