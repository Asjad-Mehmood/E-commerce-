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
    CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000,http://localhost:3001")
      .transform((v) =>
        v
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      ),

    // Auth
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: bool(false),

    // Links in emails
    STOREFRONT_URL: z.url().default("http://localhost:3000"),

    // Email (console in development, Resend when RESEND_API_KEY is set)
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Hoodie Store <no-reply@hoodie.local>"),

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

    RATE_LIMIT_ENABLED: bool(true),
    API_DOCS_ENABLED: z.enum(["true", "false"]).optional(),
  })
  .transform((e) => ({
    ...e,
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
  }))
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
    console.error("❌ Invalid environment variables:\n" + z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

/** Validated, typed environment. The process exits on startup if it is invalid. */
export const env = loadEnv();
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
