/** "Classic Pullover Hoodie!" → "classic-pullover-hoodie" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/**
 * Returns `base`, or `base-2`, `base-3`… — the first one `exists` reports as free.
 * `exists` usually wraps a `findUnique({ where: { slug } })`.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  for (let i = 2; await exists(candidate); i++) {
    candidate = `${root}-${i}`;
  }
  return candidate;
}
