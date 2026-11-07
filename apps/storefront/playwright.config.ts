import { defineConfig, devices } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const ADMIN_URL = process.env.E2E_ADMIN_URL ?? "http://localhost:3001";

/**
 * End-to-end tests against the real storefront, admin panel and API.
 * Both apps must be built first (`pnpm build`). Locally, already-running servers
 * are reused; in CI they are started here.
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
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
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
      use: { ...devices["Desktop Chrome"], baseURL: ADMIN_URL },
      testMatch: /admin\/.*\.spec/,
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @hoodie/api start",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      env: { RATE_LIMIT_ENABLED: "false" },
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @hoodie/storefront start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter @hoodie/admin start",
      url: `${ADMIN_URL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
