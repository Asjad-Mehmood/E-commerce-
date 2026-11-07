import type { ImageLoaderProps } from "next/image";

/**
 * next/image loader that lets each image host resize the picture itself, so
 * no image-optimisation server (or Vercel quota) is needed:
 * - Unsplash and Cloudinary resize on their CDNs;
 * - images uploaded to the store's database are already resized (max 1600 px
 *   WebP) when uploaded, so they are used as they are.
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  const q = quality ?? 75;
  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(q));
    url.searchParams.set("auto", "format");
    url.searchParams.delete("h");
    return url.toString();
  }
  if (src.startsWith("https://res.cloudinary.com/") && src.includes("/upload/")) {
    return src.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${width}/`);
  }
  // Same file for every width; the parameter only keeps next/image's checks happy.
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
}
