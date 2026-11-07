import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";

export const alt = `${siteConfig.name}: streetwear hoodies made in Pakistan`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The picture shown when the shop is shared on WhatsApp, Facebook, X… */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#16181d",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="8" fill="#ffffff" />
          <path d="M6.5 24C6.5 13.5 10.6 6 16 6s9.5 7.5 9.5 18Z" fill="#16181d" />
          <path d="M11.4 24c0-7.4 2-11.6 4.6-11.6s4.6 4.2 4.6 11.6Z" fill="#ffffff" />
          <path
            d="M12.6 22.5v5M19.4 22.5v5"
            stroke="#e2622b"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>URBAN STORE</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1 }}>
          Everyday streetwear hoodies, made in Pakistan.
        </div>
        <div style={{ fontSize: 34, color: "#e2622b" }}>
          Pullovers · Zip-ups · Custom embroidery · Cash on Delivery
        </div>
      </div>
    </div>,
    size,
  );
}
