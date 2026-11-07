import { defineConfig } from "vitest/config";

// Unit tests only; e2e/ holds the Playwright suite.
export default defineConfig({
  test: { include: ["admin/**/*.test.ts", "lib/**/*.test.ts", "components/**/*.test.ts"] },
});
