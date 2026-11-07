import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxies /api/v1/* to the API (API_URL), so the browser talks to this site
 * only and the login cookies are first-party (*.vercel.app is a public
 * suffix: cookies can't be shared between two vercel.app sites).
 *
 * The shopper's IP goes along in `x-client-ip`, vouched for by PROXY_SECRET,
 * so the API's rate limits apply per shopper rather than to this server.
 */
export function middleware(req: NextRequest) {
  const target =
    process.env.API_URL ??
    (process.env.NODE_ENV === "production" ? null : "http://localhost:4000/api/v1");
  if (!target) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "API_URL is not set for this site" } },
      { status: 503 },
    );
  }
  const url = new URL(
    target.replace(/\/+$/, "") + req.nextUrl.pathname.slice("/api/v1".length) + req.nextUrl.search,
  );

  const headers = new Headers(req.headers);
  headers.delete("x-proxy-secret");
  headers.delete("x-client-ip");
  const secret = process.env.PROXY_SECRET;
  const ip =
    req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (secret) {
    headers.set("x-proxy-secret", secret);
    if (ip) headers.set("x-client-ip", ip);
  }
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = { matcher: "/api/v1/:path*" };
