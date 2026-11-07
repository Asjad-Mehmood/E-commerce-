import { ErrorCode, type UploadConfigDTO } from "@hoodie/types";
import { uploadSignSchema } from "@hoodie/validation";
import { createHash } from "node:crypto";
import { env } from "../../config/env";
import { ok } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { AppError } from "../../utils/app-error";

/**
 * Cloudinary request signature: parameters sorted by name, joined as
 * `a=1&b=2`, the API secret appended, then SHA-1 hex.
 * https://cloudinary.com/documentation/authentication_signatures
 */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}

/** Vercel functions accept request bodies up to 4.5 MB; the admin resizes photos first anyway. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const cloudinaryConfigured = () =>
  !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

/**
 * Where admin image uploads go: Cloudinary when its keys are set, otherwise the
 * database (no account or credentials needed; served by GET /media/:id).
 */
export function uploadProvider(): UploadConfigDTO["provider"] {
  return cloudinaryConfigured() ? "cloudinary" : "database";
}

export const MIME: Record<NonNullable<ReturnType<typeof sniffImage>>, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/** Detects the image type from its first bytes (the Content-Type header is not trusted). */
export function sniffImage(buf: Buffer): "jpg" | "png" | "webp" | "gif" | "avif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "webp";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "gif";
  if (buf.toString("ascii", 4, 12) === "ftypavif") return "avif";
  return null;
}

export const adminUploadsRouter = defineRoutes("/admin/uploads", "Admin: Uploads", [
  route({
    method: "get",
    path: "/config",
    summary: "How images are uploaded: `cloudinary` (signed direct upload) or `database`",
    access: "MANAGER",
    handler: () => ok<UploadConfigDTO>({ provider: uploadProvider(), maxBytes: MAX_UPLOAD_BYTES }),
  }),
  route({
    method: "post",
    path: "/media",
    summary: "Upload an image, stored in the database (no image-hosting account needed)",
    description:
      "Send the raw image bytes with an `image/*` Content-Type and `?folder=products`. JPEG, PNG, WebP, GIF or AVIF up to 4 MB (the admin resizes photos before uploading). Returns the public URL.",
    access: "MANAGER",
    query: uploadSignSchema,
    status: 201,
    handler: async ({ req, query }) => {
      const body = req.body as unknown;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw AppError.badRequest("Send the image bytes with an image/* Content-Type");
      }
      const ext = sniffImage(body);
      if (!ext) throw AppError.badRequest("Only JPEG, PNG, WebP, GIF and AVIF images are allowed");
      const media = await prisma.media.create({
        data: {
          folder: query.folder,
          contentType: MIME[ext],
          bytes: new Uint8Array(body),
          size: body.length,
        },
        select: { id: true },
      });
      return ok({ url: `${env.API_PUBLIC_URL}/api/v1/media/${media.id}.${ext}` });
    },
  }),
  route({
    method: "post",
    path: "/sign",
    summary: "Get a signature for a direct browser upload to Cloudinary",
    description:
      "The browser uploads the file straight to Cloudinary (`uploadUrl`) with `file`, `api_key`, `timestamp`, `folder` and `signature`, so image bytes never pass through the API. The signature is valid for 1 hour. Returns 503 if Cloudinary is not configured.",
    access: "MANAGER",
    body: uploadSignSchema,
    handler: ({ body }) => {
      const {
        CLOUDINARY_CLOUD_NAME: cloudName,
        CLOUDINARY_API_KEY: apiKey,
        CLOUDINARY_API_SECRET: secret,
      } = env;
      if (!cloudName || !apiKey || !secret) {
        throw new AppError(
          ErrorCode.SERVICE_UNAVAILABLE,
          "Image uploads are not configured",
          undefined,
          503,
        );
      }
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `hoodie/${body.folder}`;
      return ok({
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        apiKey,
        cloudName,
        folder,
        timestamp,
        signature: signCloudinaryParams({ folder, timestamp }, secret),
      });
    },
  }),
]);
