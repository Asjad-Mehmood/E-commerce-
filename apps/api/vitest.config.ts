import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Integration tests share one database; each file creates its own uniquely named data.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
