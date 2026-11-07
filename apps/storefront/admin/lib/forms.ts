import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api";

/**
 * Shows API errors on the form: 422 field errors go next to their fields,
 * anything else becomes a form-level message (returned for display).
 */
export function applyApiError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (err instanceof ApiError) {
    const entries = Object.entries(err.fieldErrors).filter(([, msgs]) => msgs?.length);
    for (const [field, msgs] of entries) setError(field as Path<T>, { message: msgs![0] });
    return entries.length ? null : err.message;
  }
  return "Something went wrong. Check your connection and try again.";
}

/** Rupees typed by a person → minor units (paisa). Empty → null. */
export function toMinor(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Minor units → rupees for an input box (no thousands separators). */
export const fromMinor = (minor: number | null | undefined) =>
  minor == null ? "" : String(minor / 100);

/** ISO timestamp ↔ value of an <input type="datetime-local"> (browser local time). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);
