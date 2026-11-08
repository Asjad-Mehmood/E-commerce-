import { prisma } from "./prisma";

/** Reads a store setting (seeded in prisma/seed-data.ts, edited by admins in Phase 4). */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}

export async function getSettings<T extends object>(defaults: T): Promise<T> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(defaults) } } });
  const out = { ...defaults };
  for (const row of rows) (out as Record<string, unknown>)[row.key] = row.value;
  return out;
}

export interface StoreInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
}

/** Store contact details for invoices, packing slips and emails. */
export async function storeInfo(): Promise<StoreInfo> {
  const s = await getSettings({
    "store.name": "Urban Store",
    "store.email": "support@urbanstore.pk",
    "store.phone": "",
    "store.address": "",
  });
  return {
    name: s["store.name"],
    email: s["store.email"],
    phone: s["store.phone"],
    address: s["store.address"],
  };
}

/** The store's time zone, used for "today" and report periods. */
export const storeTimeZone = () => getSetting("store.timezone", "Asia/Karachi");
