import { z } from "zod";

const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-0123456789";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().optional(),
    /** Comma-separated browser origins allowed to call the API. Defaults to STOREFRONT_URL and ADMIN_URL. */
    CORS_ORIGINS: z.string().optional(),

    // Auth
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: bool(false),
    /** Optional key for encrypting secrets saved in the admin settings (defaults to one derived from JWT_ACCESS_SECRET). */
    SETTINGS_SECRET: z.string().min(16).optional(),

    // The site's address, for links in emails. The shop, the admin panel (/admin)
    // and this API (/api/v1) share one site; on Vercel it defaults to the
    // production domain, so these are only needed for a custom setup.
    STOREFRONT_URL: z.url().optional(),
    /** Admin panel address (default: STOREFRONT_URL + /admin). */
    ADMIN_URL: z.url().optional(),
    /** Public address of this API, for the URLs of uploaded images (default: STOREFRONT_URL). */
    API_PUBLIC_URL: z.url().optional(),

    // Hosting (Vercel)
    /** Vercel sends it with scheduled (cron) requests; enables GET /api/v1/cron/daily. */
    CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
    /** Set by Vercel: the project's production domain, e.g. urbanstore-api.vercel.app. */
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),

    // Email is set up in the admin (Store settings → Email). RESEND_API_KEY here is
    // an optional server-side fallback. Until one of them is set, no email is sent.
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Urban Store <orders@urbanstore.pk>"),

    // Uploads (signed direct-to-Cloudinary uploads)
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    // Payments. With STRIPE_SECRET_KEY set, cards go through Stripe; otherwise a
    // built-in demo provider (Stripe test cards, no real money) is used, which is
    // disabled in production unless ALLOW_DEMO_PAYMENTS=true.
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    ALLOW_DEMO_PAYMENTS: z.enum(["true", "false"]).optional(),
    /** Minutes an unpaid card order holds its stock. */
    PAYMENT_RESERVATION_MINUTES: z.coerce.number().int().min(5).max(120).default(15),

    // Google sign-in (optional). Both must be set to show "Continue with Google".
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    RATE_LIMIT_ENABLED: bool(true),
    /** Run the background job worker inside the API process (set false when running src/worker.ts separately). */
    RUN_WORKER: bool(true),
    API_DOCS_ENABLED: z.enum(["true", "false"]).optional(),
  })
  .transform((e) => {
    const trim = (url: string) => url.replace(/\/+$/, "");
    const site = trim(
      e.STOREFRONT_URL ??
        (e.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000"),
    );
    const admin = trim(e.ADMIN_URL ?? `${site}/admin`);
    return {
      ...e,
      STOREFRONT_URL: site,
      ADMIN_URL: admin,
      API_PUBLIC_URL: trim(e.API_PUBLIC_URL ?? site),
      CORS_ORIGINS: [
        ...new Set(
          (e.CORS_ORIGINS ?? `${site},${admin}`)
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
            .map((o) => (URL.canParse(o) ? new URL(o).origin : o)),
        ),
      ],
      // Secure cookies are always on in production.
      COOKIE_SECURE: e.NODE_ENV === "production" ? true : e.COOKIE_SECURE,
      // API docs default to on, except in production.
      API_DOCS_ENABLED:
        e.API_DOCS_ENABLED === undefined
          ? e.NODE_ENV !== "production"
          : e.API_DOCS_ENABLED === "true",
      // Demo card payments default to on, except in production.
      ALLOW_DEMO_PAYMENTS:
        e.ALLOW_DEMO_PAYMENTS === undefined
          ? e.NODE_ENV !== "production"
          : e.ALLOW_DEMO_PAYMENTS === "true",
    };
  })
  .superRefine((e, ctx) => {
    if (e.STRIPE_SECRET_KEY && !e.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["STRIPE_WEBHOOK_SECRET"],
        message: "Required with STRIPE_SECRET_KEY: payments are confirmed by Stripe webhooks",
      });
    }
    if (e.NODE_ENV === "production" && e.JWT_ACCESS_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_ACCESS_SECRET"],
        message: "Set a real secret in production (e.g. `openssl rand -base64 48`)",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = "Invalid environment variables:\n" + z.prettifyError(parsed.error);
    console.error("❌ " + message);
    throw new Error(message);
  }
  return parsed.data;
}

/** Validated, typed environment. Loading the API fails with the list of problems if it is invalid. */
export const env = loadEnv();
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
