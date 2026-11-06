import type { ApiResponse, HealthStatus } from "@hoodie/types";
import { adminConfig } from "./config";

/** Server-side API health check. Never throws: returns null when the API is unreachable. */
export async function getApiHealth(): Promise<HealthStatus | null> {
  try {
    const res = await fetch(`${adminConfig.serverApiUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const body = (await res.json()) as ApiResponse<HealthStatus>;
    return body.data;
  } catch {
    return null;
  }
}
