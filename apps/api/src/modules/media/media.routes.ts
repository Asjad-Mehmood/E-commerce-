import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { AppError } from "../../utils/app-error";

const YEAR = 365 * 24 * 60 * 60;

/** Images uploaded in the admin (stored in the database). Never change once uploaded. */
export const mediaRouter = defineRoutes("/media", "Content", [
  route({
    method: "get",
    path: "/:file",
    summary: "An uploaded image, e.g. /media/cmabc123.webp (cached for a year)",
    access: "public",
    handler: async ({ params, req, res }) => {
      const id = params.file!.replace(/\.[a-z0-9]+$/i, "");
      if (req.headers["if-none-match"] === `"${id}"`) {
        res.status(304).end();
        return;
      }
      const media = await prisma.media.findUnique({
        where: { id },
        select: { bytes: true, contentType: true },
      });
      if (!media) throw AppError.notFound("Image");
      res
        .status(200)
        .set({
          "Content-Type": media.contentType,
          "Cache-Control": `public, max-age=${YEAR}, immutable`,
          ETag: `"${id}"`,
          // Loaded by the storefront and admin, which may be on other origins.
          "Cross-Origin-Resource-Policy": "cross-origin",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "X-Content-Type-Options": "nosniff",
        })
        .send(Buffer.from(media.bytes));
    },
  }),
]);
