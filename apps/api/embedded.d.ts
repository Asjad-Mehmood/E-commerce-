// Types for "@hoodie/api/embedded" (built to dist/embedded.js by tsup), so the
// storefront can use it without compiling the API.

/** Runs a /api/v1 request through the API and returns its response. */
export function handle(request: Request): Promise<Response>;

export interface EmbeddedResponse {
  status: number;
  body: string;
}

/** An in-process GET to the API (`path` without /api/v1). */
export function request(path: string): Promise<EmbeddedResponse>;
