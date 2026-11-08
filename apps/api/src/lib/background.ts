import { waitUntil } from "@vercel/functions";

/**
 * Work that finishes after the response has been sent (emails, stock alerts).
 * On Vercel the function would otherwise be frozen as soon as it responds, so
 * the promise is registered with waitUntil; elsewhere this changes nothing.
 */
export function background<T>(work: Promise<T>): Promise<T> {
  try {
    waitUntil(work);
  } catch {
    // Not running on Vercel.
  }
  return work;
}
