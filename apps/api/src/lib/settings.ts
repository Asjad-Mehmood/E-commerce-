import { prisma } from "./prisma";

/** Reads a store setting (seeded in prisma/seed-data.ts, edited by admins in Phase 4). */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}

export async function getSettings<T extends Record<string, unknown>>(defaults: T): Promise<T> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(defaults) } } });
  const out = { ...defaults };
  for (const row of rows) (out as Record<string, unknown>)[row.key] = row.value;
  return out;
}
