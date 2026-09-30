import { ImageResponse } from "next/og";

export const alt = "AppForge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#3457d5,#1b2f7a)", color: "white", fontSize: 140, fontWeight: 700 }}>AppForge</div>,
    size,
  );
}
