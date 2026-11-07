"use client";

import { Button, Input } from "@hoodie/ui";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useImageUpload } from "@/admin/hooks/use-upload";

/**
 * Pick an image: upload a file (when uploads are configured) or paste a URL.
 * Calls `onAdd` with the URL; used for product galleries and single images.
 */
export function ImagePicker({
  folder,
  onAdd,
  multiple = false,
  label = "Upload image",
}: {
  folder: "products" | "categories" | "collections" | "banners";
  onAdd: (url: string) => void;
  multiple?: boolean;
  label?: string;
}) {
  const { upload, enabled } = useImageUpload(folder);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [url, setUrl] = useState("");

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setBusy(list.length);
    for (const file of list) {
      try {
        onAdd(await upload(file));
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  };

  const addUrl = () => {
    try {
      const parsed = new URL(url.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      onAdd(parsed.toString());
      setUrl("");
    } catch {
      toast.error("Paste a full image URL starting with https://");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {enabled && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            multiple={multiple}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => void onFiles(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            loading={busy > 0}
            onClick={() => input.current?.click()}
          >
            {busy > 0 ? `Uploading ${busy}…` : label}
          </Button>
          <span className="text-muted text-sm">or</span>
        </>
      )}
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addUrl();
          }
        }}
        placeholder="https://… image URL"
        aria-label="Image URL"
        className="h-8 w-60"
      />
      <Button variant="ghost" size="sm" onClick={addUrl} disabled={!url.trim()}>
        Add URL
      </Button>
    </div>
  );
}
