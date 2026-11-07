import "dotenv/config";
import { testDatabaseUrl } from "./test-db";

// Runs in every test worker before the test file (and the app) is imported.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-characters-long!!";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.API_DOCS_ENABLED = "true";
process.env.CORS_ORIGINS = "http://localhost:3000,http://localhost:3001";
process.env.CRON_SECRET = "test-cron-secret-0123456789";
delete process.env.PROXY_SECRET;
delete process.env.CLOUDINARY_CLOUD_NAME;
delete process.env.RESEND_API_KEY;
