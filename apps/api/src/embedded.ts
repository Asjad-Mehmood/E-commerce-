/**
 * The API as part of the storefront's Next.js app (one site, one Vercel
 * project): a route handler passes /api/v1/* requests to `handle`, and
 * server-rendered pages read data with `request`, in-process, without HTTP.
 * There is no server to start and no background worker; scheduled jobs come
 * from Vercel Cron (GET /api/v1/cron/daily).
 */
import "./embedded-mode";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { createApp } from "./app";
import { INTERNAL_HEADER, internalRequestToken } from "./middleware/internal-request";

const app = createApp();

/**
 * Runs a Web Request through the Express app and returns its Web Response.
 * The request body is read up front (uploads are at most a few MB) and the
 * response is collected, then returned in one piece.
 */
export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const socket = new Socket();
  // Express takes the shopper's address from X-Forwarded-For (set by Vercel),
  // trusting this one hop.
  Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
  Object.defineProperty(socket, "encrypted", { value: url.protocol === "https:" });

  const req = new IncomingMessage(socket);
  req.method = request.method;
  req.url = url.pathname + url.search;
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  // The host compresses responses itself.
  delete headers["accept-encoding"];
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? null
      : Buffer.from(await request.arrayBuffer());
  // Express only reads a body it knows the length of.
  delete headers["transfer-encoding"];
  if (body) headers["content-length"] = String(body.length);
  req.headers = headers;
  if (body?.length) req.push(body);
  req.push(null);

  const res = new ServerResponse(req);
  const chunks: Buffer[] = [];
  const keep = (chunk: unknown, encoding?: unknown) => {
    if (chunk == null || typeof chunk === "function") return;
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : chunk instanceof Uint8Array
          ? Buffer.from(chunk)
          : Buffer.from(
              String(chunk),
              typeof encoding === "string" ? (encoding as BufferEncoding) : "utf8",
            ),
    );
  };

  return new Promise<Response>((resolve, reject) => {
    res.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
      keep(chunk, encoding);
      if (typeof encoding === "function") encoding();
      else if (typeof cb === "function") cb();
      return true;
    }) as typeof res.write;
    res.end = ((chunk?: unknown, encoding?: unknown) => {
      keep(chunk, encoding);
      const out = new Headers();
      for (const [name, value] of Object.entries(res.getHeaders())) {
        if (value === undefined) continue;
        for (const v of Array.isArray(value) ? value : [value]) out.append(name, String(v));
      }
      const status = res.statusCode;
      const noBody = status === 204 || status === 304 || request.method === "HEAD";
      resolve(new Response(noBody ? null : Buffer.concat(chunks), { status, headers: out }));
      res.emit("finish");
      res.emit("close");
      return res;
    }) as typeof res.end;
    try {
      app(req as never, res as never);
    } catch (err) {
      reject(err);
    }
  });
}

export interface EmbeddedResponse {
  status: number;
  /** The response body (JSON as text). */
  body: string;
}

/**
 * A GET request to the API (`path` without /api/v1), answered in this process.
 * Used by server-side rendering, so it skips the per-IP rate limits.
 */
export async function request(path: string): Promise<EmbeddedResponse> {
  const res = await handle(
    new Request(`http://localhost/api/v1${path}`, {
      headers: { accept: "application/json", [INTERNAL_HEADER]: internalRequestToken() },
    }),
  );
  return { status: res.status, body: await res.text() };
}
