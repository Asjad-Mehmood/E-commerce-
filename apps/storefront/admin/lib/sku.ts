/**
 * Default SKU prefix: the title's initials plus a short code from the product id,
 * so two products with similar names don't clash ("Classic Pullover Hoodie" → "CPH-4XG").
 */
export function skuPrefixFor(title: string, id: string): string {
  const initials =
    title
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").slice(0, 1))
      .join("")
      .toUpperCase()
      .slice(0, 6) || "HD";
  return `${initials}-${id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-3)
    .toUpperCase()}`;
}
