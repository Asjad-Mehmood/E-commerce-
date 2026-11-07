#!/usr/bin/env node
// Copies each app's .env.example to its local env file, without overwriting existing files.
//   pnpm env:init
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const targets = [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/storefront/.env.example", "apps/storefront/.env.local"],
  ["apps/admin/.env.example", "apps/admin/.env.local"],
];

for (const [from, to] of targets) {
  const dest = join(process.cwd(), to);
  if (existsSync(dest)) {
    console.log(`• ${to} already exists, skipped`);
    continue;
  }
  copyFileSync(join(process.cwd(), from), dest);
  console.log(`✔ created ${to}`);
}
