import "dotenv/config";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://hoodie:hoodie@localhost:5432/hoodie_store?schema=public";
