import { ImageResponse } from "next/og";

export const alt = "The Hiring Thread, Counted — Ask HN: Who is hiring?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0e0c0a",
          color: "#ece4d6",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#ff6600",
          }}
        >
          Hacker News · Ask HN: Who is hiring?
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 900,
              lineHeight: 1.02,
            }}
          >
            <span>The Hiring&nbsp;</span>
            <span style={{ fontStyle: "italic", color: "#ff8a3d" }}>Thread</span>
            <span>,</span>
          </div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 900, lineHeight: 1.02 }}>
            Counted
          </div>
        </div>
        <div style={{ fontSize: 28, color: "#8f8473", maxWidth: 900 }}>
          Which languages and frameworks show up in the monthly threads —
          counted at the post level, with trends over time.
        </div>
      </div>
    ),
    { ...size }
  );
}
