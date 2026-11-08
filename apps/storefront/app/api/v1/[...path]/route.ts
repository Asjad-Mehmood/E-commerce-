/**
 * The store's REST API (apps/api), served by this site at /api/v1/*: each
 * request is passed to the Express app, in this process.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Seconds a request may take on Vercel (PDFs, the daily cron). */
export const maxDuration = 60;

async function api(request: Request): Promise<Response> {
  const { handle } = await import("@hoodie/api/embedded");
  return handle(request);
}

export {
  api as GET,
  api as HEAD,
  api as POST,
  api as PUT,
  api as PATCH,
  api as DELETE,
  api as OPTIONS,
};
