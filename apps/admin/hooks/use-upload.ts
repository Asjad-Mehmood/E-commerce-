"use client";

import type { ApiResponse, UploadConfigDTO } from "@hoodie/types";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api";

type Folder = "products" | "categories" | "collections" | "banners";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export function useUploadConfig() {
  return useQuery({
    queryKey: ["admin", "uploads", "config"],
    queryFn: async () => (await api<ApiResponse<UploadConfigDTO>>("/admin/uploads/config")).data,
    staleTime: Infinity,
  });
}

/**
 * Uploads an image and resolves to its public URL: straight to Cloudinary with a
 * signature from the API, or to the API itself when Cloudinary isn't configured.
 */
export function useImageUpload(folder: Folder) {
  const { data: config } = useUploadConfig();

  const upload = useCallback(
    async (file: File): Promise<string> => {
      if (!config?.provider) throw new Error("Image uploads are not configured on the server.");
      if (!ACCEPTED.includes(file.type))
        throw new Error("Use a JPEG, PNG, WebP, AVIF or GIF image.");
      if (file.size > config.maxBytes) {
        throw new Error(`Images can be up to ${Math.round(config.maxBytes / 1024 / 1024)} MB.`);
      }

      if (config.provider === "local") {
        const res = await api<ApiResponse<{ url: string }>>(
          `/admin/uploads/local?folder=${folder}`,
          {
            method: "POST",
            body: file,
          },
        );
        return res.data.url;
      }

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
