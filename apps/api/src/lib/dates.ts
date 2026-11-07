/**
 * Calendar days in the store's time zone. Orders are stored in UTC, but "today"
 * and report periods mean the store owner's local days (Asia/Karachi by default).
 */

export const DEFAULT_TIME_ZONE = "Asia/Karachi";

/** Offset of `zone` from UTC at `at`, in milliseconds (e.g. +5h for Karachi). */
export function zoneOffsetMs(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a local day (YYYY-MM-DD) starts in `zone`. */
export function startOfDay(day: string, zone: string): Date {
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const guess = new Date(utcMidnight.getTime() - zoneOffsetMs(utcMidnight, zone));
  // Re-check at the guessed instant in case a DST change sits in between.
  return new Date(utcMidnight.getTime() - zoneOffsetMs(guess, zone));
}

/** The local calendar day (YYYY-MM-DD) of an instant in `zone`. */
export function dayOf(at: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Adds whole days to a YYYY-MM-DD string. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of days from `from` to `to`. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Turns an optional inclusive day range into [start, end) instants.
 * Defaults to the last `defaultDays` days, ending today.
 */
export function dayRange(
  zone: string,
  from?: string,
  to?: string,
  defaultDays = 30,
  now = new Date(),
): { from: string; to: string; start: Date; end: Date } {
  const lastDay = to ?? dayOf(now, zone);
  const firstDay = from ?? addDays(lastDay, -(defaultDays - 1));
  return {
    from: firstDay,
    to: lastDay,
    start: startOfDay(firstDay, zone),
    end: startOfDay(addDays(lastDay, 1), zone),
  };
}
