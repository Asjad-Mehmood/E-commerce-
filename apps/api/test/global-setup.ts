import "dotenv/config";
import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-db";

/**
 * Runs once before all test files: bring the test database up to date and seed it.
 *
 * Nothing is wiped. Migrations and the seed are both non-destructive, and every
 * test creates uniquely named data, so tests never depend on an empty database.
 * (CI always starts from a fresh database anyway.)
 */
export default function setup() {
  const url = testDatabaseUrl();
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against "${dbName}": the database name must end with _test`,
    );
  }

  const env = {
    ...process.env,
    DATABASE_URL: url,
    NODE_ENV: "test",
    SEED_ADMIN_PASSWORD: "TestAdmin123",
    PRISMA_HIDE_UPDATE_MESSAGE: "1",
  };
  for (const cmd of ["pnpm exec prisma migrate deploy", "pnpm exec prisma db seed"]) {
    try {
      execSync(cmd, { stdio: "pipe", env });
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      throw new Error(
        `"${cmd}" failed:\n${e.stdout?.toString() ?? ""}${e.stderr?.toString() ?? ""}`,
      );
    }
  }
}
