/**
 * Tests run against a separate database so they never touch development data.
 * TEST_DATABASE_URL wins; otherwise DATABASE_URL's database name gets a `_test` suffix.
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base =
    process.env.DATABASE_URL ??
    "postgresql://hoodie:hoodie@localhost:5432/hoodie_store?schema=public";
  const url = new URL(base);
  if (!url.pathname.endsWith("_test")) url.pathname = `${url.pathname}_test`;
  return url.toString();
}
