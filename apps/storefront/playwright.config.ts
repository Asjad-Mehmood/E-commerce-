import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * End-to-end tests against the real site: the shop, the admin panel (/admin)
 * and the API (/api/v1). Build it first (`pnpm build`). Locally an
 * already-running site is reused; in CI it is started here.
 */
export default defineConfig({
  testDir: "./e2e",
  // Card tests need demo card payments, which the store has off by default.
  globalSetup: "./e2e/card-payments.ts",
  globalTeardown: "./e2e/card-payments-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/mobile\.spec/, /admin\//],
    },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /admin\/.*\.spec/,
    },
  ],
  webServer: {
    command: "pnpm --filter @hoodie/storefront start",
    url: `${BASE_URL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    // A production build: it needs a non-default secret and demo card payments
    // allowed explicitly; and the tests sign in more often than the login rate
    // limit allows.
    env: {
      JWT_ACCESS_SECRET:
        process.env.JWT_ACCESS_SECRET ?? "e2e-only-secret-at-least-32-characters-long",
      ALLOW_DEMO_PAYMENTS: "true",
      RATE_LIMIT_ENABLED: "false",
    },
    timeout: 90_000,
  },
});
