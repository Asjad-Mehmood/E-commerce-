import { ErrorCode } from "@hoodie/types";
import { uploadSignSchema } from "@hoodie/validation";
import { createHash } from "node:crypto";
import { env } from "../../config/env";
import { ok } from "../../lib/http";
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

export const adminUploadsRouter = defineRoutes("/admin/uploads", "Admin: Uploads", [
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
