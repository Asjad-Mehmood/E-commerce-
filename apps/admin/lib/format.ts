import { formatMoney } from "@hoodie/types";

export { formatMoney };

/** The store's time zone: dates in the admin read as the shop owner's local time. */
export const STORE_TIME_ZONE = "Asia/Karachi";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: STORE_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: STORE_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? dateTime.format(new Date(iso)) : "—";
export const formatDate = (iso: string | null | undefined) =>
  iso ? dateOnly.format(new Date(iso)) : "—";

/** "5 min ago", "3 days ago"; falls back to the date after a week. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

/** Today in the store's time zone, as YYYY-MM-DD. */
export function storeToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Percentage change, or null when there is nothing to compare with. */
export function percentChange(value: number, previous: number): number | null {
  if (previous === 0) return value === 0 ? 0 : null;
  return ((value - previous) / previous) * 100;
}

export const plural = (n: number, word: string, many = `${word}s`) =>
  `${n.toLocaleString("en-PK")} ${n === 1 ? word : many}`;
