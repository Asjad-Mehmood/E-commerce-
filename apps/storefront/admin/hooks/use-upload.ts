"use client";

import type { ApiResponse, UploadConfigDTO } from "@hoodie/types";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/admin/lib/api";

type Folder = "products" | "categories" | "collections" | "banners";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

/** Longest side of photos stored in the database. */
const MAX_SIDE = 1600;

/**
 * Shrinks a photo in the browser (longest side 1600 px, WebP) so it stays
 * small in the database and fast on the storefront. GIFs (maybe animated) and
 * images that wouldn't get smaller are sent as they are.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    // Some browsers fall back to PNG when they can't encode WebP.
    if (!blob || !ACCEPTED.includes(blob.type)) return file;
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function useUploadConfig() {
  return useQuery({
    queryKey: ["admin", "uploads", "config"],
    queryFn: async () => (await api<ApiResponse<UploadConfigDTO>>("/admin/uploads/config")).data,
    staleTime: Infinity,
  });
}

/**
 * Uploads an image and resolves to its public URL: straight to Cloudinary with a
 * signature from the API, or (no Cloudinary account needed) resized in the
 * browser and stored in the database by the API.
 */
export function useImageUpload(folder: Folder) {
  const { data: config } = useUploadConfig();

  const upload = useCallback(
    async (file: File): Promise<string> => {
      if (!config?.provider) throw new Error("Image uploads are not configured on the server.");
      if (!ACCEPTED.includes(file.type))
        throw new Error("Use a JPEG, PNG, WebP, AVIF or GIF image.");
      const tooBig = () =>
        new Error(`Images can be up to ${Math.round(config.maxBytes / 1024 / 1024)} MB.`);

      if (config.provider === "database") {
        const image = await shrinkImage(file);
        if (image.size > config.maxBytes) throw tooBig();
        const res = await api<ApiResponse<{ url: string }>>(
          `/admin/uploads/media?folder=${folder}`,
          { method: "POST", body: image },
        );
        return res.data.url;
      }

      if (file.size > config.maxBytes) throw tooBig();

      const { data: sig } = await api<
        ApiResponse<{
          uploadUrl: string;
          apiKey: string;
          timestamp: number;
          folder: string;
          signature: string;
        }>
      >("/admin/uploads/sign", { method: "POST", body: { folder } });
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("signature", sig.signature);
      const res = await fetch(sig.uploadUrl, { method: "POST", body: form });
      const json = (await res.json()) as { secure_url?: string; error?: { message: string } };
      if (!res.ok || !json.secure_url) throw new Error(json.error?.message ?? "Upload failed");
      return json.secure_url;
    },
    [config, folder],
  );

  return { upload, enabled: !!config?.provider, provider: config?.provider ?? null };
}
