const KEY = "recently-viewed";
const MAX = 12;

/** Slugs of products this browser viewed, most recent first (stored on this device only). */
export function readRecentlyViewed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function rememberViewed(slug: string): string[] {
  const next = [slug, ...readRecentlyViewed().filter((s) => s !== slug)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage full: the strip just stays empty.
  }
  return next;
}
