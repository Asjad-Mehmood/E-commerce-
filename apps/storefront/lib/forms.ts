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
    for (const [field, msgs] of entries) {
      setError(field as Path<T>, { message: msgs![0] });
    }
    return entries.length ? null : err.message;
  }
  return "Something went wrong. Please check your connection and try again.";
}
